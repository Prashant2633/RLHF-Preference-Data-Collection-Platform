from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from app.db import get_db
from app.auth import get_current_user, require_role
from app.models import Task, AgentRun, ResponsePair, Annotator
from app.schemas import TaskCreate, TaskResponse, ResponsePairResponse
from app.llm.generator import generate_trajectory
from app.config import settings

router = APIRouter(prefix="/tasks", tags=["tasks"])

@router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(
    payload: TaskCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Annotator = Depends(require_role(["lead", "admin"]))
):
    """
    Create a new task. Restricted to leads and admins.
    """
    task = Task(
        prompt=payload.prompt,
        available_tools=payload.available_tools,
        context=payload.context,
        created_by=current_user.id
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return task

@router.get("", response_model=list[TaskResponse])
async def list_tasks(
    db: AsyncSession = Depends(get_db),
    current_user: Annotator = Depends(get_current_user)
):
    """
    List all tasks.
    """
    result = await db.execute(select(Task).order_by(Task.created_at.desc()))
    tasks = result.scalars().all()
    return tasks

@router.post("/{id}/generate", response_model=ResponsePairResponse, status_code=status.HTTP_201_CREATED)
async def generate_response_pair(
    id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Annotator = Depends(require_role(["lead", "admin"]))
):
    """
    Calls both Groq and Gemini to produce two trajectories for the task,
    creates two AgentRuns and one ResponsePair. Restricted to leads and admins.
    """
    result = await db.execute(select(Task).where(Task.id == id))
    task = result.scalars().first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )
    
    # Generate trajectories in parallel to prevent Vercel 10-second serverless timeout
    import asyncio
    
    results = await asyncio.gather(
        generate_trajectory(task.prompt, task.available_tools, "groq"),
        generate_trajectory(task.prompt, task.available_tools, "gemini"),
        return_exceptions=True
    )
    
    trajectory_groq, trajectory_gemini = results
    
    if isinstance(trajectory_groq, Exception):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Groq generation failed: {str(trajectory_groq)}"
        )
        
    if isinstance(trajectory_gemini, Exception):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Gemini generation failed: {str(trajectory_gemini)}"
        )

    # Save Agent Runs
    run_a = AgentRun(
        task_id=task.id,
        provider="groq",
        model_name=settings.GROQ_MODEL,
        trajectory=trajectory_groq
    )
    run_b = AgentRun(
        task_id=task.id,
        provider="gemini",
        model_name=settings.GEMINI_MODEL,
        trajectory=trajectory_gemini
    )
    db.add(run_a)
    db.add(run_b)
    await db.flush() # get IDs for run_a and run_b

    # Create Response Pair
    pair = ResponsePair(
        task_id=task.id,
        run_a_id=run_a.id,
        run_b_id=run_b.id,
        status="pending"
    )
    db.add(pair)
    await db.commit()
    await db.refresh(pair)

    return pair
