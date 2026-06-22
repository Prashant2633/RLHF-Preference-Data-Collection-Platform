import json
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Any

from app.db import get_db
from app.auth import get_current_user
from app.models import ResponsePair, ExportLog, Annotator
from app.export import format_dpo_pair, format_constitutional_ai_pair

router = APIRouter(prefix="/export", tags=["export"])

async def stream_jsonl(pairs: list[ResponsePair], format_type: str):
    for pair in pairs:
        if format_type in ("groq_jsonl", "gemini_jsonl"):
            formatted = format_dpo_pair(pair)
        elif format_type == "constitutional_ai":
            formatted = format_constitutional_ai_pair(pair)
        else:
            continue
            
        if formatted is not None:
            yield json.dumps(formatted) + "\n"

async def handle_export(format_type: str, exclude_ties: bool, db: AsyncSession, current_user: Annotator):
    # Fetch resolved pairs
    query = (
        select(ResponsePair)
        .options(
            selectinload(ResponsePair.task),
            selectinload(ResponsePair.run_a),
            selectinload(ResponsePair.run_b),
            selectinload(ResponsePair.annotations)
        )
        .where(ResponsePair.resolved_preference.isnot(None))
    )
    
    if exclude_ties:
        query = query.where(ResponsePair.resolved_preference != "tie")
        
    result = await db.execute(query)
    pairs = result.scalars().all()
    
    pair_count = len(pairs)
    
    # Record export log
    export_log = ExportLog(
        format=format_type,
        pair_count=pair_count,
        exported_by=current_user.id
    )
    db.add(export_log)
    await db.commit()
    
    # Stream the data
    return StreamingResponse(
        stream_jsonl(pairs, format_type),
        media_type="application/x-jsonlines",
        headers={"Content-Disposition": f"attachment; filename={format_type}_{int(datetime.utcnow().timestamp())}.jsonl"}
    )

from datetime import datetime

@router.get("/groq-jsonl")
async def export_groq_jsonl(
    db: AsyncSession = Depends(get_db),
    current_user: Annotator = Depends(get_current_user)
):
    """
    Download resolved non-tied pairs in Groq DPO format.
    """
    return await handle_export("groq_jsonl", exclude_ties=True, db=db, current_user=current_user)

@router.get("/gemini-jsonl")
async def export_gemini_jsonl(
    db: AsyncSession = Depends(get_db),
    current_user: Annotator = Depends(get_current_user)
):
    """
    Download resolved non-tied pairs in Gemini DPO format.
    """
    return await handle_export("gemini_jsonl", exclude_ties=True, db=db, current_user=current_user)

@router.get("/constitutional-ai")
async def export_constitutional_ai(
    db: AsyncSession = Depends(get_db),
    current_user: Annotator = Depends(get_current_user)
):
    """
    Download resolved pairs in Constitutional AI format (including ties).
    """
    return await handle_export("constitutional_ai", exclude_ties=False, db=db, current_user=current_user)
