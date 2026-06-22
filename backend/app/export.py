import json
from typing import Any
from app.models import ResponsePair, Annotation

def format_dpo_pair(pair: ResponsePair) -> dict[str, Any] | None:
    """
    Format a ResponsePair into DPO fine-tuning format.
    Returns None if the pair is a tie or not resolved.
    """
    if not pair.resolved_preference or pair.resolved_preference == "tie":
        return None
        
    prompt = pair.task.prompt
    trajectory_a = json.dumps(pair.run_a.trajectory)
    trajectory_b = json.dumps(pair.run_b.trajectory)
    
    if pair.resolved_preference == "a":
        chosen = trajectory_a
        rejected = trajectory_b
    elif pair.resolved_preference == "b":
        chosen = trajectory_b
        rejected = trajectory_a
    else:
        return None
        
    return {
        "prompt": prompt,
        "chosen": chosen,
        "rejected": rejected
    }

def format_constitutional_ai_pair(pair: ResponsePair) -> dict[str, Any]:
    """
    Format a ResponsePair into Anthropic Constitutional AI format.
    Supports tie pairs where preferred is null.
    """
    prompt = pair.task.prompt
    trajectory_a = json.dumps(pair.run_a.trajectory)
    trajectory_b = json.dumps(pair.run_b.trajectory)
    
    preferred_val = None
    if pair.resolved_preference == "a":
        preferred_val = "response_a"
    elif pair.resolved_preference == "b":
        preferred_val = "response_b"
        
    critique = generate_critique(pair.resolved_preference, pair.annotations)
    
    return {
        "prompt": prompt,
        "response_a": trajectory_a,
        "response_b": trajectory_b,
        "preferred": preferred_val,
        "critique": critique,
        "principle": "Agent responses must be grounded in verified tool outputs and must complete the user's full instruction before reporting success."
    }

def generate_critique(resolved_pref: str | None, annotations: list[Annotation]) -> str:
    """
    Generates a deterministic critique string highlighting why the losing response scored lower.
    Looks for rubric dimensions where the loser scored >= 2 points lower on average.
    """
    if not annotations:
        return "No annotations available to generate critique."
        
    dimensions = [
        "tool_selection", "argument_validity", "chain_completeness", 
        "hallucination", "safety", "clarity", "efficiency", "instruction_adherence"
    ]
    
    dim_names = {
        "tool_selection": "tool selection",
        "argument_validity": "argument validity",
        "chain_completeness": "chain completeness",
        "hallucination": "groundedness",
        "safety": "safety and constraints",
        "clarity": "clarity and organization",
        "efficiency": "efficiency",
        "instruction_adherence": "instruction adherence"
    }
    
    # Calculate average scores
    avg_scores = {}
    for dim in dimensions:
        scores_a = [ann.rubric_scores.get(dim, {}).get("a", 3) for ann in annotations if ann.rubric_scores]
        scores_b = [ann.rubric_scores.get(dim, {}).get("b", 3) for ann in annotations if ann.rubric_scores]
        
        avg_scores[dim] = {
            "a": sum(scores_a) / len(scores_a) if scores_a else 3.0,
            "b": sum(scores_b) / len(scores_b) if scores_b else 3.0
        }
        
    critique_sentences = []
    
    if resolved_pref == "a":
        for dim in dimensions:
            gap = avg_scores[dim]["a"] - avg_scores[dim]["b"]
            if gap >= 2.0:
                critique_sentences.append(
                    f"Response B showed deficiencies in {dim_names[dim]} (average score {avg_scores[dim]['b']:.1f} vs Response A's {avg_scores[dim]['a']:.1f})."
                )
        if not critique_sentences:
            critique_sentences.append("Response B had minor deficiencies compared to Response A across multiple dimensions.")
            
    elif resolved_pref == "b":
        for dim in dimensions:
            gap = avg_scores[dim]["b"] - avg_scores[dim]["a"]
            if gap >= 2.0:
                critique_sentences.append(
                    f"Response A showed deficiencies in {dim_names[dim]} (average score {avg_scores[dim]['a']:.1f} vs Response B's {avg_scores[dim]['b']:.1f})."
                )
        if not critique_sentences:
            critique_sentences.append("Response A had minor deficiencies compared to Response B across multiple dimensions.")
            
    else:
        critique_sentences.append("Both responses achieved comparable performance on the task, resulting in a tie.")
        
    return " ".join(critique_sentences)
