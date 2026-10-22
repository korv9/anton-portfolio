"""Rank statistics for SWEDEN Connections: Spearman's ρ, partial ρ, bootstrap intervals (iid and
county cluster), residual permutation p and Holm's adjustment. Each draw uses the generator it is
given, so a fixed seed gives the same numbers."""
from __future__ import annotations

import numpy as np

RESAMPLES = 2000
ROUNDS = 9999


def ranks(x: np.ndarray) -> np.ndarray:
    """0-based ranks, ties averaged."""
    _, inverse, counts = np.unique(x, return_inverse=True, return_counts=True)
    end = np.cumsum(counts)
    return ((end - counts + end - 1) / 2)[inverse]


def spearman(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.corrcoef(ranks(a), ranks(b))[0, 1])


def residuals(a: np.ndarray, controls: list[np.ndarray]) -> np.ndarray:
    """a's ranks after removing the ranks of the controls linearly."""
    design = np.column_stack([np.ones(len(a))] + [ranks(z) for z in controls])
    y = ranks(a)
    return y - design @ np.linalg.lstsq(design, y, rcond=None)[0]


def partial(a: np.ndarray, b: np.ndarray, controls: list[np.ndarray]) -> float:
    """Spearman's ρ of a and b after removing the controls linearly from all ranks."""
    return float(np.corrcoef(residuals(a, controls), residuals(b, controls))[0, 1])


def cluster_sample(groups: np.ndarray, rng) -> np.ndarray:
    """Row indices of whole groups drawn with replacement."""
    ids = np.unique(groups)
    return np.concatenate([np.flatnonzero(groups == g) for g in rng.choice(ids, len(ids))])


def interval(stat, n: int, rng, groups: np.ndarray | None = None) -> list[float]:
    """95 % percentile bootstrap of stat(index), over rows, or over whole groups when given."""
    draws = [stat(cluster_sample(groups, rng) if groups is not None else rng.integers(0, n, n))
             for _ in range(RESAMPLES)]
    return [round(float(v), 3) for v in np.percentile(draws, [2.5, 97.5])]


def permutation_p(a: np.ndarray, b: np.ndarray, controls: list[np.ndarray], rng) -> float:
    """Two-sided p of the partial ρ: one residual vector shuffled against the other."""
    ea, eb = residuals(a, controls), residuals(b, controls)
    observed = abs(np.corrcoef(ea, eb)[0, 1])
    hits = sum(abs(np.corrcoef(ea, rng.permutation(eb))[0, 1]) >= observed for _ in range(ROUNDS))
    return (1 + hits) / (1 + ROUNDS)


def holm(p: list[float]) -> list[float]:
    """Holm's step-down adjustment, in the input order."""
    order = sorted(range(len(p)), key=p.__getitem__)
    out, running = [0.0] * len(p), 0.0
    for i, k in enumerate(order):
        running = max(running, min(1.0, (len(p) - i) * p[k]))
        out[k] = running
    return out
