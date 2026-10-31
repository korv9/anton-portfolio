"""Which groups of one corpus sit near which groups of another?

For every passage in corpus A, its nearest passages in corpus B (whitened space). A group of A
(a party, say) links to a group of B (a philosopher) by how often its neighbours land there,
against how often the neighbours of all of A land there:

    lift(a, b) = P(neighbour in b | passage from a) / P(neighbour in b | passage from A)

So lift 1 is "no different from the rest of the corpus". It compares within A, so hubs in B that
everything lands near do not count as links. Passages of one debate, book or employer are
correlated, so the interval resamples those units of A, not passages.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from .space import top_k

K = 5
MIN_PASSAGES = 40
ITERATIONS = 300
SEED = 0


def _lifts(counts: np.ndarray) -> np.ndarray:
    row = counts.sum(axis=1, keepdims=True)
    base = counts.sum(axis=0, keepdims=True) / max(counts.sum(), 1)
    with np.errstate(divide='ignore', invalid='ignore'):
        return np.where(row > 0, (counts / np.maximum(row, 1)) / np.maximum(base, 1e-12), np.nan)


def affinity(frame: pd.DataFrame, space: np.ndarray, a: str, b: str, k: int = K,
             min_passages: int = MIN_PASSAGES, iterations: int = ITERATIONS) -> list[dict]:
    rows_a = np.flatnonzero(frame.corpus.to_numpy() == a)
    rows_b = np.flatnonzero(frame.corpus.to_numpy() == b)
    groups_a = frame.group.to_numpy()[rows_a]
    units_a = frame.unit.to_numpy()[rows_a]
    groups_b = frame.group.to_numpy()[rows_b]
    keep_a = pd.Series(groups_a).value_counts()
    keep_a = keep_a[keep_a >= min_passages].index.tolist()
    keep_b = pd.Series(groups_b).value_counts()
    keep_b = keep_b[keep_b >= min_passages].index.tolist()
    if not keep_a or not keep_b:
        return []
    index_a = {g: i for i, g in enumerate(keep_a)}
    index_b = {g: i for i, g in enumerate(keep_b)}
    near = groups_b[top_k(space[rows_a], space[rows_b], k)]          # (passages of A, k)
    ga = np.array([index_a.get(g, -1) for g in groups_a])
    gb = np.vectorize(lambda g: index_b.get(g, -1))(near)

    def counts(selection: np.ndarray) -> np.ndarray:
        out = np.zeros((len(keep_a), len(keep_b)))
        sa, sb = ga[selection], gb[selection]
        mask = (sa[:, None] >= 0) & (sb >= 0)
        np.add.at(out, (np.broadcast_to(sa[:, None], sb.shape)[mask], sb[mask]), 1)
        return out

    observed = _lifts(counts(np.arange(len(rows_a))))
    units = pd.unique(units_a)
    by_unit = pd.Series(np.arange(len(rows_a))).groupby(units_a).indices
    rng = np.random.default_rng(SEED)
    draws = []
    for _ in range(iterations):
        picked = rng.choice(units, size=len(units), replace=True)
        draws.append(_lifts(counts(np.concatenate([by_unit[u] for u in picked]))))
    low, high = np.nanpercentile(np.stack(draws), [2.5, 97.5], axis=0)
    out = []
    for i, ga_name in enumerate(keep_a):
        for j, gb_name in enumerate(keep_b):
            if np.isfinite(observed[i, j]):
                out.append({'from': ga_name, 'to': gb_name, 'lift': round(float(observed[i, j]), 3),
                            'low': round(float(low[i, j]), 3), 'high': round(float(high[i, j]), 3)})
    return out


def strongest(rows: list[dict], top: int = 3) -> list[dict]:
    """Per group of A, the groups of B it leans to, only where the interval clears 1."""
    clear = [r for r in rows if r['low'] > 1]
    out = []
    for name in dict.fromkeys(r['from'] for r in clear):
        mine = sorted((r for r in clear if r['from'] == name), key=lambda r: -r['lift'])
        out += mine[:top]
    return out
