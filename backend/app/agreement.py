import numpy as np
from sklearn.metrics import cohen_kappa_score
from typing import Any

def calculate_kappas(annotations: list[dict[str, Any]], min_shared: int = 5) -> dict[str, Any]:
    """
    Calculate Cohen's Kappa for overall preference (unweighted) and the 8 rubric dimensions
    (linear-weighted, pooled across response A and B ratings).

    annotations is a list of dictionaries, where each dict has:
      - "pair_id": UUID or str
      - "annotator_id": UUID or str
      - "overall_preference": str ('a' | 'b' | 'tie')
      - "rubric_scores": dict, e.g. {"tool_selection": {"a": 5, "b": 2}, ...}
    """
    dimensions = [
        "tool_selection",
        "argument_validity",
        "chain_completeness",
        "hallucination",
        "safety",
        "clarity",
        "efficiency",
        "instruction_adherence",
    ]

    # Group annotations by annotator
    # annotator_id -> pair_id -> annotation_dict
    by_annotator: dict[Any, dict[Any, dict[str, Any]]] = {}
    for ann in annotations:
        aid = ann["annotator_id"]
        pid = ann["pair_id"]
        if aid not in by_annotator:
            by_annotator[aid] = {}
        by_annotator[aid][pid] = ann

    annotator_ids = list(by_annotator.keys())
    num_annotators = len(annotator_ids)

    overall_kappas = []
    dim_kappas_accum: dict[str, list[float]] = {d: [] for d in dimensions}

    # Perform pairwise comparisons
    for i in range(num_annotators):
        for j in range(i + 1, num_annotators):
            aid1 = annotator_ids[i]
            aid2 = annotator_ids[j]

            # Find shared pair IDs
            pairs1 = by_annotator[aid1]
            pairs2 = by_annotator[aid2]
            shared_pids = set(pairs1.keys()).intersection(set(pairs2.keys()))

            if len(shared_pids) < min_shared:
                continue

            # Calculate overall preference kappa
            prefs1 = [pairs1[pid]["overall_preference"] for pid in shared_pids]
            prefs2 = [pairs2[pid]["overall_preference"] for pid in shared_pids]

            # Check if there is only one unique value across both and it matches
            if len(set(prefs1)) == 1 and len(set(prefs2)) == 1 and prefs1[0] == prefs2[0]:
                k_pref = 1.0
            else:
                k_pref = cohen_kappa_score(prefs1, prefs2)
                if np.isnan(k_pref):
                    k_pref = 1.0 if prefs1 == prefs2 else 0.0

            overall_kappas.append(float(k_pref))

            # Calculate per-dimension kappa
            for dim in dimensions:
                # Pool A and B scores together
                scores1 = []
                scores2 = []
                for pid in shared_pids:
                    dim1 = pairs1[pid]["rubric_scores"].get(dim, {"a": 3, "b": 3})
                    dim2 = pairs2[pid]["rubric_scores"].get(dim, {"a": 3, "b": 3})
                    scores1.extend([dim1["a"], dim1["b"]])
                    scores2.extend([dim2["a"], dim2["b"]])

                # Ensure values are within labels [1, 2, 3, 4, 5]
                if len(set(scores1)) == 1 and len(set(scores2)) == 1 and scores1[0] == scores2[0]:
                    k_dim = 1.0
                else:
                    k_dim = cohen_kappa_score(
                        scores1,
                        scores2,
                        weights="linear",
                        labels=[1, 2, 3, 4, 5]
                    )
                    if np.isnan(k_dim):
                        k_dim = 1.0 if scores1 == scores2 else 0.0

                dim_kappas_accum[dim].append(float(k_dim))

    # Average the pairwise scores
    avg_overall_kappa = float(np.mean(overall_kappas)) if overall_kappas else 0.0
    avg_dim_kappas = {}
    for dim in dimensions:
        accum = dim_kappas_accum[dim]
        avg_dim_kappas[dim] = float(np.mean(accum)) if accum else 0.0

    return {
        "overall_preference_kappa": avg_overall_kappa,
        "dimension_kappas": avg_dim_kappas,
    }
