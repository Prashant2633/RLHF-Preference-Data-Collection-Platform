from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func
from uuid import UUID

from app.db import get_db
from app.auth import get_current_user
from app.models import ResponsePair, Annotation, Annotator, Task, AgentRun
from app.schemas import AnnotationCreate, AnnotationResponse, ResponsePairDetailResponse, AnnotationListResponse, ResponsePairResponse

router = APIRouter(prefix="/pairs", tags=["pairs"])

@router.get("/next", response_model=ResponsePairResponse)
async def get_next_pair(
    db: AsyncSession = Depends(get_db),
    current_user: Annotator = Depends(get_current_user)
):
    """
    Return the next pair for the current annotator.
    Rule: Never return a pair this annotator has already scored.
    Priority: Prefer pairs with exactly 1 existing annotation (status 'in_review')
    over pairs with 0 (status 'pending').
    """
    # Subquery to find pair_ids the user has already annotated
    user_annotated_sub = select(Annotation.pair_id).where(Annotation.annotator_id == current_user.id)
    
    # Query to count annotations per pair
    # and select the highest priority pair that the current annotator hasn't annotated
    query = (
        select(ResponsePair, func.count(Annotation.id).label("ann_count"))
        .outerjoin(Annotation, ResponsePair.id == Annotation.pair_id)
        .where(ResponsePair.status.in_(["pending", "in_review"]))
        .where(ResponsePair.id.not_in(user_annotated_sub))
        .group_by(ResponsePair.id)
        .order_by(
            func.count(Annotation.id).desc(), # 1 annotation preferred over 0
            ResponsePair.created_at.asc()     # oldest first
        )
        .limit(1)
    )
    
    result = await db.execute(query)
    row = result.first()
    
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No new response pairs available for annotation"
        )
        
    return row[0]

@router.get("/{id}", response_model=ResponsePairDetailResponse)
async def get_pair_detail(
    id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Annotator = Depends(get_current_user)
):
    """
    Get full pair detail: both trajectories + existing annotations.
    Peer annotations are hidden unless the current annotator has already scored the pair,
    or the current annotator is a lead/admin.
    """
    query = (
        select(ResponsePair)
        .where(ResponsePair.id == id)
    )
    result = await db.execute(query)
    pair = result.scalars().first()
    if not pair:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Response pair not found"
        )
        
    # Get annotations with annotator details
    ann_query = (
        select(Annotation, Annotator.display_name)
        .join(Annotator, Annotation.annotator_id == Annotator.id)
        .where(Annotation.pair_id == id)
    )
    ann_result = await db.execute(ann_query)
    annotations_data = ann_result.all()
    
    has_annotated = any(ann.annotator_id == current_user.id for ann, _ in annotations_data)
    is_privileged = current_user.role in ("lead", "admin")
    
    serialized_annotations = []
    if has_annotated or is_privileged:
        for ann, name in annotations_data:
            serialized_annotations.append(
                AnnotationListResponse(
                    id=ann.id,
                    annotator_id=ann.annotator_id,
                    annotator_name=name or ann.email,
                    overall_preference=ann.overall_preference,
                    rubric_scores=ann.rubric_scores,
                    notes=ann.notes,
                    created_at=ann.created_at
                )
            )
            
    # Resolve related fields
    task_res = await db.execute(select(Task).where(Task.id == pair.task_id))
    task = task_res.scalars().first()
    
    run_a_res = await db.execute(select(AgentRun).where(AgentRun.id == pair.run_a_id))
    run_a = run_a_res.scalars().first()
    
    run_b_res = await db.execute(select(AgentRun).where(AgentRun.id == pair.run_b_id))
    run_b = run_b_res.scalars().first()

    return ResponsePairDetailResponse(
        id=pair.id,
        task_id=pair.task_id,
        run_a_id=pair.run_a_id,
        run_b_id=pair.run_b_id,
        status=pair.status,
        resolved_preference=pair.resolved_preference,
        created_at=pair.created_at,
        task=task,
        run_a=run_a,
        run_b=run_b,
        annotations=serialized_annotations
    )

@router.post("/{id}/annotations", response_model=AnnotationResponse, status_code=status.HTTP_201_CREATED)
async def submit_annotation(
    id: UUID,
    payload: AnnotationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Annotator = Depends(get_current_user)
):
    """
    Submit this annotator's scores for a pair.
    Auto-resolve or flag based on calibration criteria if this is the 2nd+ annotation.
    """
    # Verify pair exists and is open for annotation
    pair_res = await db.execute(select(ResponsePair).where(ResponsePair.id == id))
    pair = pair_res.scalars().first()
    if not pair:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Response pair not found"
        )
        
    if pair.status in ["resolved", "exported"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This pair is already resolved or exported and cannot be annotated further."
        )

    # Check if annotator already scored this pair
    existing_ann_res = await db.execute(
        select(Annotation).where(Annotation.pair_id == id, Annotation.annotator_id == current_user.id)
    )
    if existing_ann_res.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have already submitted an annotation for this pair."
        )

    # Create new annotation
    # Convert rubric scores to dict
    rubric_dict = payload.rubric_scores.model_dump()
    new_ann = Annotation(
        pair_id=id,
        annotator_id=current_user.id,
        overall_preference=payload.overall_preference,
        rubric_scores=rubric_dict,
        notes=payload.notes
    )
    db.add(new_ann)
    await db.flush() # flush to generate ID and include in subsequent queries

    # Check for other annotations for this pair
    all_anns_res = await db.execute(
        select(Annotation).where(Annotation.pair_id == id)
    )
    all_anns = all_anns_res.scalars().all()
    
    if len(all_anns) >= 2:
        # Check overall preference agreement
        first_pref = all_anns[0].overall_preference
        all_pref_match = all(ann.overall_preference == first_pref for ann in all_anns)
        
        # Check rubric dimensions score difference (gap >= 2)
        dimensions = [
            "tool_selection", "argument_validity", "chain_completeness", 
            "hallucination", "safety", "clarity", "efficiency", "instruction_adherence"
        ]
        rubric_gap_exceeded = False
        
        for i in range(len(all_anns)):
            for j in range(i + 1, len(all_anns)):
                r1 = all_anns[i].rubric_scores
                r2 = all_anns[j].rubric_scores
                
                for dim in dimensions:
                    score1_a = r1.get(dim, {}).get("a", 3)
                    score1_b = r1.get(dim, {}).get("b", 3)
                    score2_a = r2.get(dim, {}).get("a", 3)
                    score2_b = r2.get(dim, {}).get("b", 3)
                    
                    if abs(score1_a - score2_a) >= 2 or abs(score1_b - score2_b) >= 2:
                        rubric_gap_exceeded = True
                        break
                if rubric_gap_exceeded:
                    break
        
        if all_pref_match and not rubric_gap_exceeded:
            pair.status = "resolved"
            pair.resolved_preference = first_pref
        else:
            pair.status = "calibration_flagged"
    else:
        # 1st annotation, moves from 'pending' to 'in_review'
        pair.status = "in_review"
        
    await db.commit()
    await db.refresh(new_ann)
    return new_ann
