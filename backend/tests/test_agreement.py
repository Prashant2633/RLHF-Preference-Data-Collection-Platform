import pytest
import numpy as np
from app.agreement import calculate_kappas

def test_perfect_agreement():
    # Two annotators who score 5 pairs identically
    annotations = []
    # Annotator 1
    for i in range(5):
        annotations.append({
            "pair_id": f"pair_{i}",
            "annotator_id": "ann_1",
            "overall_preference": "a" if i % 2 == 0 else "b",
            "rubric_scores": {
                "tool_selection": {"a": 5, "b": 2},
                "argument_validity": {"a": 4, "b": 3},
                "chain_completeness": {"a": 5, "b": 4},
                "hallucination": {"a": 5, "b": 5},
                "safety": {"a": 5, "b": 5},
                "clarity": {"a": 4, "b": 4},
                "efficiency": {"a": 3, "b": 3},
                "instruction_adherence": {"a": 5, "b": 2},
            }
        })
    # Annotator 2 (identical scores)
    for i in range(5):
        annotations.append({
            "pair_id": f"pair_{i}",
            "annotator_id": "ann_2",
            "overall_preference": "a" if i % 2 == 0 else "b",
            "rubric_scores": {
                "tool_selection": {"a": 5, "b": 2},
                "argument_validity": {"a": 4, "b": 3},
                "chain_completeness": {"a": 5, "b": 4},
                "hallucination": {"a": 5, "b": 5},
                "safety": {"a": 5, "b": 5},
                "clarity": {"a": 4, "b": 4},
                "efficiency": {"a": 3, "b": 3},
                "instruction_adherence": {"a": 5, "b": 2},
            }
        })

    result = calculate_kappas(annotations, min_shared=5)
    assert result["overall_preference_kappa"] == 1.0
    for dim, val in result["dimension_kappas"].items():
        assert val == 1.0

def test_insufficient_shared_pairs():
    # Only 3 shared pairs when min_shared = 5
    annotations = []
    for i in range(3):
        annotations.append({
            "pair_id": f"pair_{i}",
            "annotator_id": "ann_1",
            "overall_preference": "a",
            "rubric_scores": {
                "tool_selection": {"a": 5, "b": 2},
                "argument_validity": {"a": 4, "b": 3},
                "chain_completeness": {"a": 5, "b": 4},
                "hallucination": {"a": 5, "b": 5},
                "safety": {"a": 5, "b": 5},
                "clarity": {"a": 4, "b": 4},
                "efficiency": {"a": 3, "b": 3},
                "instruction_adherence": {"a": 5, "b": 2},
            }
        })
        annotations.append({
            "pair_id": f"pair_{i}",
            "annotator_id": "ann_2",
            "overall_preference": "a",
            "rubric_scores": {
                "tool_selection": {"a": 5, "b": 2},
                "argument_validity": {"a": 4, "b": 3},
                "chain_completeness": {"a": 5, "b": 4},
                "hallucination": {"a": 5, "b": 5},
                "safety": {"a": 5, "b": 5},
                "clarity": {"a": 4, "b": 4},
                "efficiency": {"a": 3, "b": 3},
                "instruction_adherence": {"a": 5, "b": 2},
            }
        })

    result = calculate_kappas(annotations, min_shared=5)
    # Since they don't meet min_shared, it should return 0.0
    assert result["overall_preference_kappa"] == 0.0
    for val in result["dimension_kappas"].values():
        assert val == 0.0

def test_kappa_math_calculation():
    # Let's create a known contingency table for overall_preference
    # Annotator 1 and Annotator 2 have 10 shared pairs:
    # Ann 1: [a, a, a, a, a, b, b, b, b, tie]
    # Ann 2: [a, a, a, b, b, b, b, tie, tie, tie]
    # Contingency Table for (a, b, tie):
    #       Ann 2
    #       a  b  tie
    # Ann1
    # a     3  2  0   | 5
    # b     0  2  2   | 4
    # tie   0  0  1   | 1
    #       --------
    #       3  4  3   | 10
    #
    # Observed agreement (Po): (3 + 2 + 1) / 10 = 0.6
    # Expected agreement (Pe):
    # P(a) = (5/10) * (3/10) = 0.15
    # P(b) = (4/10) * (4/10) = 0.16
    # P(tie) = (1/10) * (3/10) = 0.03
    # Pe = 0.15 + 0.16 + 0.03 = 0.34
    # Kappa = (Po - Pe) / (1 - Pe) = (0.6 - 0.34) / (1 - 0.34) = 0.26 / 0.66 = 0.393939...
    
    ann1_prefs = ["a", "a", "a", "a", "a", "b", "b", "b", "b", "tie"]
    ann2_prefs = ["a", "a", "a", "b", "b", "b", "b", "tie", "tie", "tie"]
    
    # We will set rubric scores to be identical for simplicity (kappa=1.0 for dimensions)
    dummy_rubric = {
        "tool_selection": {"a": 5, "b": 2},
        "argument_validity": {"a": 5, "b": 2},
        "chain_completeness": {"a": 5, "b": 2},
        "hallucination": {"a": 5, "b": 2},
        "safety": {"a": 5, "b": 2},
        "clarity": {"a": 5, "b": 2},
        "efficiency": {"a": 5, "b": 2},
        "instruction_adherence": {"a": 5, "b": 2},
    }

    annotations = []
    for i in range(10):
        annotations.append({
            "pair_id": f"pair_{i}",
            "annotator_id": "ann_1",
            "overall_preference": ann1_prefs[i],
            "rubric_scores": dummy_rubric
        })
        annotations.append({
            "pair_id": f"pair_{i}",
            "annotator_id": "ann_2",
            "overall_preference": ann2_prefs[i],
            "rubric_scores": dummy_rubric
        })

    result = calculate_kappas(annotations, min_shared=5)
    # Check overall kappa
    assert pytest.approx(result["overall_preference_kappa"], rel=1e-4) == 0.393939
    # Dimensions should be 1.0 since they agree perfectly
    for dim, val in result["dimension_kappas"].items():
        assert val == 1.0
