import pytest
from app.models import ResponsePair, Task, AgentRun, Annotation
from app.export import format_dpo_pair, format_constitutional_ai_pair

class DummyObj:
    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)

def test_dpo_format_success():
    task = DummyObj(prompt="Test prompt")
    run_a = DummyObj(trajectory=[{"type": "final_response", "content": "A"}])
    run_b = DummyObj(trajectory=[{"type": "final_response", "content": "B"}])
    
    pair = DummyObj(
        task=task,
        run_a=run_a,
        run_b=run_b,
        resolved_preference="a"
    )
    
    result = format_dpo_pair(pair)
    assert result is not None
    assert result["prompt"] == "Test prompt"
    assert "A" in result["chosen"]
    assert "B" in result["rejected"]

def test_dpo_format_tie():
    task = DummyObj(prompt="Test prompt")
    run_a = DummyObj(trajectory=[{"type": "final_response", "content": "A"}])
    run_b = DummyObj(trajectory=[{"type": "final_response", "content": "B"}])
    
    pair = DummyObj(
        task=task,
        run_a=run_a,
        run_b=run_b,
        resolved_preference="tie"
    )
    
    # Ties must return None for DPO format
    assert format_dpo_pair(pair) is None

def test_constitutional_ai_format_success():
    task = DummyObj(prompt="Test prompt")
    run_a = DummyObj(trajectory=[{"type": "final_response", "content": "A"}])
    run_b = DummyObj(trajectory=[{"type": "final_response", "content": "B"}])
    
    # Setup annotations with high gap in tool_selection (A=5, B=1)
    ann = DummyObj(
        rubric_scores={
            "tool_selection": {"a": 5, "b": 1},
            "argument_validity": {"a": 4, "b": 4},
            "chain_completeness": {"a": 3, "b": 3},
            "hallucination": {"a": 3, "b": 3},
            "safety": {"a": 3, "b": 3},
            "clarity": {"a": 3, "b": 3},
            "efficiency": {"a": 3, "b": 3},
            "instruction_adherence": {"a": 3, "b": 3},
        }
    )
    
    pair = DummyObj(
        task=task,
        run_a=run_a,
        run_b=run_b,
        resolved_preference="a",
        annotations=[ann]
    )
    
    result = format_constitutional_ai_pair(pair)
    assert result["prompt"] == "Test prompt"
    assert result["preferred"] == "response_a"
    # Critique should highlight tool_selection deficiencies for B
    assert "tool selection" in result["critique"]
    assert "Response B showed deficiencies" in result["critique"]

def test_constitutional_ai_format_tie():
    task = DummyObj(prompt="Test prompt")
    run_a = DummyObj(trajectory=[{"type": "final_response", "content": "A"}])
    run_b = DummyObj(trajectory=[{"type": "final_response", "content": "B"}])
    
    ann = DummyObj(
        rubric_scores={
            "tool_selection": {"a": 3, "b": 3},
            "argument_validity": {"a": 3, "b": 3},
            "chain_completeness": {"a": 3, "b": 3},
            "hallucination": {"a": 3, "b": 3},
            "safety": {"a": 3, "b": 3},
            "clarity": {"a": 3, "b": 3},
            "efficiency": {"a": 3, "b": 3},
            "instruction_adherence": {"a": 3, "b": 3},
        }
    )
    
    pair = DummyObj(
        task=task,
        run_a=run_a,
        run_b=run_b,
        resolved_preference="tie",
        annotations=[ann]
    )
    
    result = format_constitutional_ai_pair(pair)
    assert result["prompt"] == "Test prompt"
    assert result["preferred"] is None
    assert "tie" in result["critique"]
