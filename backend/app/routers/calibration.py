from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from uuid import UUID
from datetime import datetime

from app.db import get_db
from app.auth import get_current_user, require_role
from app.models import ResponsePair, Annotation, Annotator, CalibrationSession, Task, AgentRun
from app.schemas import CalibrationSessionCreate, CalibrationSessionResponse, CalibrationStats, ResponsePairDetailResponse, AnnotationListResponse
from app.agreement import calculate_kappas
from app.config import settings

router = APIRouter(prefix="/calibration", tags=["calibration"])

@router.get("/stats", response_model=CalibrationStats)
async def get_calibration_stats(
    db: AsyncSession = Depends(get_db),
    current_user: Annotator = Depends(get_current_user)
):
    """
    Calculate Cohen's kappa (overall preference and per-dimension).
    """
    # Fetch all annotations
    result = await db.execute(select(Annotation))
    annotations = result.scalars().all()
    
    # Format for agreement module
    annotations_list = []
    for ann in annotations:
        annotations_list.append({
            "pair_id": str(ann.pair_id),
            "annotator_id": str(ann.annotator_id),
            "overall_preference": ann.overall_preference,
            "rubric_scores": ann.rubric_scores
        })
        
    kappas = calculate_kappas(
        annotations_list,
        min_shared=settings.MIN_SHARED_ANNOTATIONS_FOR_KAPPA
    )
    return kappas

@router.get("/flagged", response_model=list[ResponsePairDetailResponse])
async def list_flagged_pairs(
    db: AsyncSession = Depends(get_db),
    current_user: Annotator = Depends(get_current_user)
):
    """
    List response pairs flagged for calibration review (status = 'calibration_flagged').
    """
    query = (
        select(ResponsePair)
        .where(ResponsePair.status == "calibration_flagged")
        .order_by(ResponsePair.created_at.desc())
    )
    result = await db.execute(query)
    pairs = result.scalars().all()
    
    detailed_pairs = []
    for pair in pairs:
        # Load related data
        task_res = await db.execute(select(Task).where(Task.id == pair.task_id))
        task = task_res.scalars().first()
        
        run_a_res = await db.execute(select(AgentRun).where(AgentRun.id == pair.run_a_id))
        run_a = run_a_res.scalars().first()
        
        run_b_res = await db.execute(select(AgentRun).where(AgentRun.id == pair.run_b_id))
        run_b = run_b_res.scalars().first()
        
        ann_query = (
            select(Annotation, Annotator.display_name)
            .join(Annotator, Annotation.annotator_id == Annotator.id)
            .where(Annotation.pair_id == pair.id)
        )
        ann_result = await db.execute(ann_query)
        annotations_data = ann_result.all()
        
        serialized_annotations = [
            AnnotationListResponse(
                id=ann.id,
                annotator_id=ann.annotator_id,
                annotator_name=name or ann.email,
                overall_preference=ann.overall_preference,
                rubric_scores=ann.rubric_scores,
                notes=ann.notes,
                created_at=ann.created_at
            )
            for ann, name in annotations_data
        ]
        
        detailed_pairs.append(
            ResponsePairDetailResponse(
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
        )
        
    return detailed_pairs

# Resolve mapping schema
from pydantic import BaseModel
from typing import Literal

class PairResolution(BaseModel):
    pair_id: UUID
    resolved_preference: Literal["a", "b", "tie"]

class CalibrationSessionCreatePayload(BaseModel):
    resolutions: list[PairResolution]
    dimension: str | None = None
    resolution_notes: str | None = None

@router.post("/sessions", response_model=CalibrationSessionResponse, status_code=status.HTTP_201_CREATED)
async def create_calibration_session(
    payload: CalibrationSessionCreatePayload,
    db: AsyncSession = Depends(get_db),
    current_user: Annotator = Depends(require_role(["lead", "admin"]))
):
    """
    Record a calibration session, resolving the specified pairs.
    Restricted to leads and admins.
    """
    pair_ids = [res.pair_id for res in payload.resolutions]
    
    if not pair_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one pair must be resolved in a session"
        )
        
    # Verify all pairs exist and are flagged
    pairs_query = select(ResponsePair).where(ResponsePair.id.in_(pair_ids))
    pairs_result = await db.execute(pairs_query)
    pairs = pairs_result.scalars().all()
    
    found_pair_ids = {p.id for p in pairs}
    missing_ids = set(pair_ids) - found_pair_ids
    if missing_ids:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Response pair(s) not found: {', '.join(str(i) for i in missing_ids)}"
        )
        
    # Resolve all pairs
    resolution_map = {res.pair_id: res.resolved_preference for res in payload.resolutions}
    for pair in pairs:
        pair.status = "resolved"
        pair.resolved_preference = resolution_map[pair.id]
        
    # Record the calibration session
    session = CalibrationSession(
        led_by=current_user.id,
        pair_ids=pair_ids,
        dimension=payload.dimension,
        resolution_notes=payload.resolution_notes,
        resolved_at=datetime.utcnow()
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    
    return session
