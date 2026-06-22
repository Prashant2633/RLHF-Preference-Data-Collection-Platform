from pydantic import BaseModel, EmailStr, Field, model_validator
from uuid import UUID
from datetime import datetime
from typing import Any, Literal

# Rubric score score pair (1 to 5)
class DimensionScore(BaseModel):
    a: int = Field(..., ge=1, le=5)
    b: int = Field(..., ge=1, le=5)

# The full 8 rubric dimensions
class RubricScores(BaseModel):
    tool_selection: DimensionScore
    argument_validity: DimensionScore
    chain_completeness: DimensionScore
    hallucination: DimensionScore
    safety: DimensionScore
    clarity: DimensionScore
    efficiency: DimensionScore
    instruction_adherence: DimensionScore

# Annotator schemas
class AnnotatorBase(BaseModel):
    email: str
    display_name: str | None = None
    role: Literal["annotator", "lead", "admin"] = "annotator"

class AnnotatorCreate(AnnotatorBase):
    firebase_uid: str

class AnnotatorResponse(AnnotatorBase):
    id: UUID
    firebase_uid: str
    created_at: datetime

    class Config:
        from_attributes = True

# Task schemas
class TaskBase(BaseModel):
    prompt: str
    available_tools: list[dict[str, Any]]
    context: dict[str, Any] = Field(default_factory=dict)

class TaskCreate(TaskBase):
    pass

class TaskResponse(TaskBase):
    id: UUID
    created_by: UUID | None = None
    created_at: datetime

    class Config:
        from_attributes = True

# Agent Run schemas
class AgentRunResponse(BaseModel):
    id: UUID
    task_id: UUID
    provider: Literal["groq", "gemini"]
    model_name: str
    trajectory: list[dict[str, Any]]
    created_at: datetime

    class Config:
        from_attributes = True

# Annotation schemas
class AnnotationCreate(BaseModel):
    overall_preference: Literal["a", "b", "tie"]
    rubric_scores: RubricScores
    notes: str | None = None

class AnnotationResponse(BaseModel):
    id: UUID
    pair_id: UUID
    annotator_id: UUID
    overall_preference: Literal["a", "b", "tie"]
    rubric_scores: RubricScores
    notes: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True

class AnnotationListResponse(BaseModel):
    id: UUID
    annotator_id: UUID
    annotator_name: str | None
    overall_preference: Literal["a", "b", "tie"]
    rubric_scores: RubricScores
    notes: str | None = None
    created_at: datetime

# Response Pair schemas
class ResponsePairResponse(BaseModel):
    id: UUID
    task_id: UUID
    run_a_id: UUID
    run_b_id: UUID
    status: Literal["pending", "in_review", "calibration_flagged", "resolved", "exported"]
    resolved_preference: Literal["a", "b", "tie"] | None = None
    created_at: datetime

    class Config:
        from_attributes = True

class ResponsePairDetailResponse(ResponsePairResponse):
    task: TaskResponse
    run_a: AgentRunResponse
    run_b: AgentRunResponse
    annotations: list[AnnotationListResponse] = []

    class Config:
        from_attributes = True

# Calibration Session schemas
class CalibrationSessionCreate(BaseModel):
    pair_ids: list[UUID]
    dimension: str | None = None
    resolution_notes: str | None = None

class CalibrationSessionResponse(BaseModel):
    id: UUID
    led_by: UUID | None = None
    pair_ids: list[UUID]
    dimension: str | None = None
    resolution_notes: str | None = None
    resolved_at: datetime | None = None
    created_at: datetime

    class Config:
        from_attributes = True

# Export Log schemas
class ExportLogResponse(BaseModel):
    id: UUID
    format: Literal["groq_jsonl", "gemini_jsonl", "constitutional_ai"]
    pair_count: int
    exported_by: UUID | None = None
    created_at: datetime

    class Config:
        from_attributes = True

# Calibration Stats schemas
class CalibrationStats(BaseModel):
    overall_preference_kappa: float
    dimension_kappas: dict[str, float]
