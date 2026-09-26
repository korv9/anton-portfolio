"""Uncertainty and null hypotheses.

Confidence intervals resample the grouping unit, not the row. Rows within a debate or an
employer are correlated, so resampling rows treats correlated observations as independent
and produces an interval several times too narrow.
"""
from __future__ import annotations

from typing import Callable

import numpy as np
from sklearn.metrics import f1_score, roc_auc_score


def cluster_bootstrap(
    metric: Callable[[np.ndarray, np.ndarray], float],
    truth: np.ndarray,
    predicted: np.ndarray,
    groups: np.ndarray,
    iterations: int = 1000,
    seed: int = 0,
) -> dict:
    """Resample whole groups with replacement and report the percentile interval."""
    rng = np.random.default_rng(seed)
    unique = np.unique(groups)
    index_by_group = {group: np.where(groups == group)[0] for group in unique}
    values = []
    for _ in range(iterations):
        drawn = rng.choice(unique, size=len(unique), replace=True)
        rows = np.concatenate([index_by_group[group] for group in drawn])
        try:
            values.append(metric(truth[rows], predicted[rows]))
        except ValueError:
            continue  # a resample can miss a class entirely
    if not values:
        return {"point": None, "low": None, "high": None, "iterations": 0}
    return {
        "point": float(metric(truth, predicted)),
        "low": float(np.percentile(values, 2.5)),
        "high": float(np.percentile(values, 97.5)),
        "iterations": len(values),
    }


def paired_cluster_bootstrap(
    metric: Callable[[np.ndarray, np.ndarray], float],
    truth: np.ndarray,
    first: np.ndarray,
    second: np.ndarray,
    groups: np.ndarray,
    iterations: int = 1000,
    seed: int = 0,
) -> dict:
    """Interval for metric(first) - metric(second) on the same resampled groups.

    Two models scored on one test set are correlated: a hard debate is hard for both. Each
    model's own interval ignores that, so comparing a difference against one of them is far
    too strict. Resampling the groups once and scoring both models on the same draw keeps
    the pairing.
    """
    rng = np.random.default_rng(seed)
    unique = np.unique(groups)
    index_by_group = {group: np.where(groups == group)[0] for group in unique}
    values = []
    for _ in range(iterations):
        drawn = rng.choice(unique, size=len(unique), replace=True)
        rows = np.concatenate([index_by_group[group] for group in drawn])
        try:
            values.append(metric(truth[rows], first[rows]) - metric(truth[rows], second[rows]))
        except ValueError:
            continue
    if not values:
        return {"point": None, "low": None, "high": None, "iterations": 0}
    return {
        "point": float(metric(truth, first) - metric(truth, second)),
        "low": float(np.percentile(values, 2.5)),
        "high": float(np.percentile(values, 97.5)),
        "iterations": len(values),
    }


def permutation_test(
    metric: Callable[[np.ndarray, np.ndarray], float],
    truth: np.ndarray,
    predicted: np.ndarray,
    iterations: int = 1000,
    seed: int = 0,
) -> dict:
    """How often does shuffled truth reach the observed score?

    Without this a classifier separating eight parties looks impressive at any AUC above a
    half, when the achievable floor depends on class balance and sample size.
    """
    rng = np.random.default_rng(seed)
    observed = float(metric(truth, predicted))
    shuffled = truth.copy()
    null = []
    for _ in range(iterations):
        rng.shuffle(shuffled)
        try:
            null.append(metric(shuffled, predicted))
        except ValueError:
            continue
    null_array = np.asarray(null)
    # Add-one so a p-value is never reported as exactly zero.
    p_value = float((1 + (null_array >= observed).sum()) / (1 + len(null_array)))
    return {
        "observed": observed,
        "null_mean": float(null_array.mean()) if len(null_array) else None,
        "p_value": p_value,
        "iterations": len(null_array),
    }


def macro_f1(truth: np.ndarray, predicted: np.ndarray) -> float:
    return float(f1_score(truth, predicted, average="macro", zero_division=0))


def auc(truth: np.ndarray, scores: np.ndarray) -> float:
    return float(roc_auc_score(truth, scores))


def mean_pairwise_auc(truth: np.ndarray, scores: np.ndarray, labels: list) -> dict:
    """Mean one-versus-one AUC across every party pair.

    Reported as the mean of pairs rather than one-versus-rest, because one-versus-rest is
    dominated by whichever party speaks most.
    """
    pairs = []
    for i, left in enumerate(labels):
        for right in labels[i + 1:]:
            mask = np.isin(truth, [left, right])
            if mask.sum() < 10:
                continue
            binary = (truth[mask] == right).astype(int)
            if binary.min() == binary.max():
                continue
            column = labels.index(right)
            pairs.append({
                "pair": f"{left}-{right}",
                "auc": float(roc_auc_score(binary, scores[mask, column])),
            })
    if not pairs:
        return {"mean_auc": None, "pairs": []}
    return {"mean_auc": float(np.mean([p["auc"] for p in pairs])), "pairs": pairs}
