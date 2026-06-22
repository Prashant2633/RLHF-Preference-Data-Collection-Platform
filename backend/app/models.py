import uuid
from sqlalchemy import (
    Column,
    String,
    ForeignKey,
    DateTime,
    Integer,
    UniqueConstraint,
    text,
    func,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import relationship
from app.db import Base

# Custom compilers to allow SQLite in tests to compile PostgreSQL-specific JSONB and ARRAY types
@compiles(JSONB, "sqlite")
def compile_jsonb_sqlite(type_, compiler, **kw):
    return "TEXT"

@compiles(ARRAY, "sqlite")
def compile_array_sqlite(type_, compiler, **kw):
    return "TEXT"


class Annotator(Base):
    __tablename__ = "annotators"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    firebase_uid = Column(String, unique=True, nullable=False)
    email = Column(String, nullable=False)
    display_name = Column(String, nullable=True)
    role = Column(String, nullable=False, default="annotator", server_default="annotator") # 'annotator' | 'lead' | 'admin'
    created_at = Column(DateTime(timezone=True), nullable=False, default=func.now(), server_default=func.now())

    tasks = relationship("Task", back_populates="creator")
    annotations = relationship("Annotation", back_populates="annotator")
    calibration_sessions = relationship("CalibrationSession", back_populates="leader")
    exports = relationship("ExportLog", back_populates="exporter")

class Task(Base):
    __tablename__ = "tasks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    prompt = Column(String, nullable=False)
    available_tools = Column(JSONB, nullable=False)
    context = Column(JSONB, nullable=True, default=dict, server_default="{}")
    created_by = Column(UUID(as_uuid=True), ForeignKey("annotators.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=func.now(), server_default=func.now())

    creator = relationship("Annotator", back_populates="tasks")
    runs = relationship("AgentRun", back_populates="task")
    pairs = relationship("ResponsePair", back_populates="task")

class AgentRun(Base):
    __tablename__ = "agent_runs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    task_id = Column(UUID(as_uuid=True), ForeignKey("tasks.id"), nullable=False)
    provider = Column(String, nullable=False) # 'groq' | 'gemini'
    model_name = Column(String, nullable=False)
    trajectory = Column(JSONB, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=func.now(), server_default=func.now())

    task = relationship("Task", back_populates="runs")

class ResponsePair(Base):
    __tablename__ = "response_pairs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    task_id = Column(UUID(as_uuid=True), ForeignKey("tasks.id"), nullable=False)
    run_a_id = Column(UUID(as_uuid=True), ForeignKey("agent_runs.id"), nullable=False)
    run_b_id = Column(UUID(as_uuid=True), ForeignKey("agent_runs.id"), nullable=False)
    status = Column(String, nullable=False, default="pending", server_default="pending") # 'pending' | 'in_review' | 'calibration_flagged' | 'resolved' | 'exported'
    resolved_preference = Column(String, nullable=True) # 'a' | 'b' | 'tie'
    created_at = Column(DateTime(timezone=True), nullable=False, default=func.now(), server_default=func.now())

    task = relationship("Task", back_populates="pairs")
    run_a = relationship("AgentRun", foreign_keys=[run_a_id])
    run_b = relationship("AgentRun", foreign_keys=[run_b_id])
    annotations = relationship("Annotation", back_populates="pair", cascade="all, delete-orphan")

class Annotation(Base):
    __tablename__ = "annotations"
    __table_args__ = (
        UniqueConstraint("pair_id", "annotator_id", name="uq_pair_annotator"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    pair_id = Column(UUID(as_uuid=True), ForeignKey("response_pairs.id"), nullable=False)
    annotator_id = Column(UUID(as_uuid=True), ForeignKey("annotators.id"), nullable=False)
    overall_preference = Column(String, nullable=False) # 'a' | 'b' | 'tie'
    rubric_scores = Column(JSONB, nullable=False)
    notes = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=func.now(), server_default=func.now())

    pair = relationship("ResponsePair", back_populates="annotations")
    annotator = relationship("Annotator", back_populates="annotations")

class CalibrationSession(Base):
    __tablename__ = "calibration_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    led_by = Column(UUID(as_uuid=True), ForeignKey("annotators.id"), nullable=True)
    pair_ids = Column(ARRAY(UUID(as_uuid=True)), nullable=False)
    dimension = Column(String, nullable=True)
    resolution_notes = Column(String, nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=func.now(), server_default=func.now())

    leader = relationship("Annotator", back_populates="calibration_sessions")

class ExportLog(Base):
    __tablename__ = "export_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    format = Column(String, nullable=False) # 'groq_jsonl' | 'gemini_jsonl' | 'constitutional_ai'
    pair_count = Column(Integer, nullable=False)
    exported_by = Column(UUID(as_uuid=True), ForeignKey("annotators.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=func.now(), server_default=func.now())

    exporter = relationship("Annotator", back_populates="exports")
