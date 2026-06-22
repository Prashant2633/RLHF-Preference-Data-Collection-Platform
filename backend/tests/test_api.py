import pytest
import asyncio
import json
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import StaticPool

# Import settings and override directly for testing
from app.config import settings
settings.MOCK_AUTH = True
settings.MIN_SHARED_ANNOTATIONS_FOR_KAPPA = 1
settings.GROQ_API_KEY = "dummy"
settings.GEMINI_API_KEY = "dummy"

from app.db import Base, get_db
from app.main import app

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

engine = create_async_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False
)

# Override database dependency
async def override_get_db():
    async with TestingSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

app.dependency_overrides[get_db] = override_get_db

@pytest.fixture(autouse=True)
async def setup_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

client = TestClient(app)

@pytest.mark.asyncio
async def test_end_to_end_flow():
    # Setup headers with mock user roles (which bypasses Firebase SDK verification via settings.MOCK_AUTH)
    admin_headers = {"Authorization": "Bearer mock_admin"}
    ann1_headers = {"Authorization": "Bearer mock_annotator_1"}
    ann2_headers = {"Authorization": "Bearer mock_annotator_2"}

    # 1. Create a task (Admin)
    task_data = {
        "prompt": "Find flights from NYC to SFO next Friday",
        "available_tools": [
            {
                "type": "function",
                "function": {
                    "name": "search_flights",
                    "description": "Search flights",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "origin": {"type": "string"},
                            "destination": {"type": "string"},
                            "date": {"type": "string"}
                        },
                        "required": ["origin", "destination", "date"]
                    }
                }
            }
        ],
        "context": {}
    }
    
    response = client.post("/tasks", json=task_data, headers=admin_headers)
    assert response.status_code == 201
    task_id = response.json()["id"]

    # 2. Generate a response pair (Mocking LLM API calls)
    mock_trajectory_groq = [
        {"type": "tool_call", "name": "search_flights", "arguments": {"origin": "NYC", "destination": "SFO", "date": "2026-06-26"}},
        {"type": "tool_result", "name": "search_flights", "result": {"success": True, "flights": [{"flight_number": "AA-102", "price": 285}]}},
        {"type": "final_response", "content": "Flight AA-102 costs $285."}
    ]
    
    mock_trajectory_gemini = [
        {"type": "tool_call", "name": "search_flights", "arguments": {"origin": "NYC", "destination": "SFO", "date": "2026-06-26"}},
        {"type": "tool_result", "name": "search_flights", "result": {"success": True, "flights": [{"flight_number": "AA-102", "price": 285}]}},
        {"type": "final_response", "content": "The flight is AA-102, price: $285."}
    ]

    with patch("app.routers.tasks.generate_trajectory") as mock_gen:
        mock_gen.side_effect = [mock_trajectory_groq, mock_trajectory_gemini]

        gen_response = client.post(f"/tasks/{task_id}/generate", headers=admin_headers)
        assert gen_response.status_code == 201
        pair_id = gen_response.json()["id"]

    # 3. Get next pair to annotate for Annotator 1
    next_pair_res = client.get("/pairs/next", headers=ann1_headers)
    assert next_pair_res.status_code == 200
    assert next_pair_res.json()["id"] == pair_id

    # 4. Annotator 1 submits rating: overall_preference='a'
    annotation_payload = {
        "overall_preference": "a",
        "rubric_scores": {
            "tool_selection": {"a": 5, "b": 5},
            "argument_validity": {"a": 5, "b": 5},
            "chain_completeness": {"a": 5, "b": 5},
            "hallucination": {"a": 5, "b": 5},
            "safety": {"a": 5, "b": 5},
            "clarity": {"a": 5, "b": 5},
            "efficiency": {"a": 5, "b": 5},
            "instruction_adherence": {"a": 5, "b": 5}
        },
        "notes": "Good trajectory"
    }
    
    ann_res = client.post(f"/pairs/{pair_id}/annotations", json=annotation_payload, headers=ann1_headers)
    assert ann_res.status_code == 201

    # Check Response Pair detail for Annotator 1 (should show annotation)
    detail_res = client.get(f"/pairs/{pair_id}", headers=ann1_headers)
    assert detail_res.status_code == 200
    assert len(detail_res.json()["annotations"]) == 1

    # Check Response Pair detail for Annotator 2 (should hide peer annotations to prevent anchoring)
    detail_res_peer = client.get(f"/pairs/{pair_id}", headers=ann2_headers)
    assert detail_res_peer.status_code == 200
    assert len(detail_res_peer.json()["annotations"]) == 0

    # 5. Annotator 2 submits identical rating -> should trigger auto-resolution to 'resolved'
    ann_res_2 = client.post(f"/pairs/{pair_id}/annotations", json=annotation_payload, headers=ann2_headers)
    assert ann_res_2.status_code == 201

    # Check status (should be resolved, resolved_preference='a')
    detail_resolved = client.get(f"/pairs/{pair_id}", headers=ann1_headers)
    assert detail_resolved.json()["status"] == "resolved"
    assert detail_resolved.json()["resolved_preference"] == "a"

    # 6. Check stats endpoint
    stats_res = client.get("/calibration/stats", headers=ann1_headers)
    assert stats_res.status_code == 200
    # Perfect agreement should mean kappa = 1.0
    assert stats_res.json()["overall_preference_kappa"] == 1.0

    # 7. Check export endpoints (since resolved, it should export)
    export_res = client.get("/export/groq-jsonl", headers=ann1_headers)
    assert export_res.status_code == 200
    export_lines = export_res.text.strip().split("\n")
    assert len(export_lines) == 1
    
    dpo_record = json.loads(export_lines[0])
    assert dpo_record["prompt"] == "Find flights from NYC to SFO next Friday"
    assert "AA-102" in dpo_record["chosen"]
    assert "AA-102" in dpo_record["rejected"]
