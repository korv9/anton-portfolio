"""Which groups of one corpus sit near which groups of another?

For every passage in corpus A, its nearest passages in corpus B (whitened space). A group of A
(a party, say) links to a group of B (a philosopher) by how often its neighbours land there,
against how often the neighbours of all of A land there:

    lift(a, b) = P(neighbour in b | passage from a) / P(neighbour in b | passage from A)

So lift 1 is "no different from the rest of the corpus". It compares within A, so hubs in B that
everything lands near do not count as links. Passages of one debate, book or employer are
correlated, so the interval resamples those units of A, not passages. A group with fewer than
MIN_UNITS units (a philosopher with one work, a law) would then only see the baseline move, so
its units are cut into blocks of BLOCK consecutive passages and the blocks are resampled.

Every link gets a one-sided p-value (log lift over its bootstrap standard deviation), and
`adjust` applies Benjamini–Hochberg across all links of all corpus pairs together. `null=True`
shuffles A's group labels between resampling blocks first, to check how many links appear by chance.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from scipy.stats import norm

from .space import top_k

K = 5
MIN_PASSAGES = 40
ITERATIONS = 300
MIN_UNITS = 5
BLOCK = 20
ALPHA = 0.05
SEED = 0


def _lifts(counts: np.ndarray) -> np.ndarray:
    row = counts.sum(axis=1, keepdims=True)
    base = counts.sum(axis=0, keepdims=True) / max(counts.sum(), 1)
    with np.errstate(divide='ignore', invalid='ignore'):
        return np.where(row > 0, (counts / np.maximum(row, 1)) / np.maximum(base, 1e-12), np.nan)


def resampling_units(part: pd.DataFrame) -> np.ndarray:
    """One corpus's units, with units of thinly covered groups cut into blocks of BLOCK passages."""
    units = part.unit.astype(str).to_numpy()
    few = part.groupby('group').unit.transform('nunique').to_numpy() < MIN_UNITS
    block = (part.groupby('unit').cumcount().to_numpy() // BLOCK).astype(str)
    return np.where(few, np.char.add(np.char.add(units.astype(str), '#'), block), units)


def neighbours(frame: pd.DataFrame, space: np.ndarray, a: str, b: str, k: int = K) -> np.ndarray:
    rows_a = np.flatnonzero(frame.corpus.to_numpy() == a)
    rows_b = np.flatnonzero(frame.corpus.to_numpy() == b)
    return frame.group.to_numpy()[rows_b][top_k(space[rows_a], space[rows_b], k)]


def affinity(frame: pd.DataFrame, space: np.ndarray, a: str, b: str, k: int = K,
             min_passages: int = MIN_PASSAGES, iterations: int = ITERATIONS,
             near: np.ndarray | None = None, null: bool = False, seed: int = SEED) -> list[dict]:
    part = frame[frame.corpus.to_numpy() == a]
    groups_a = part.group.to_numpy().copy()
    units_a = resampling_units(part)
    rng = np.random.default_rng(seed)
    if null:   # shuffle group labels between (unit, group) blocks, keeping each block whole
        blocks = pd.Series(units_a + '|' + groups_a.astype(str))
        first = blocks.drop_duplicates()
        mapping = dict(zip(first, rng.permutation(groups_a[first.index])))
        groups_a = blocks.map(mapping).to_numpy()
    groups_b = frame.group.to_numpy()[frame.corpus.to_numpy() == b]
    keep_a = pd.Series(groups_a).value_counts()
    keep_a = keep_a[keep_a >= min_passages].index.tolist()
    keep_b = pd.Series(groups_b).value_counts()
    keep_b = keep_b[keep_b >= min_passages].index.tolist()
    if not keep_a or not keep_b:
        return []
    near = neighbours(frame, space, a, b, k) if near is None else near   # (passages of A, k)
    index_a = {g: i for i, g in enumerate(keep_a)}
    index_b = {g: i for i, g in enumerate(keep_b)}
    ga = np.array([index_a.get(g, -1) for g in groups_a])
    gb = np.vectorize(lambda g: index_b.get(g, -1))(near)

    def counts(selection: np.ndarray) -> np.ndarray:
        out = np.zeros((len(keep_a), len(keep_b)))
        sa, sb = ga[selection], gb[selection]
        mask = (sa[:, None] >= 0) & (sb >= 0)
        np.add.at(out, (np.broadcast_to(sa[:, None], sb.shape)[mask], sb[mask]), 1)
        return out

    observed = _lifts(counts(np.arange(len(part))))
    units = pd.unique(units_a)
    by_unit = pd.Series(np.arange(len(part))).groupby(units_a).indices
    draws = []
    for _ in range(iterations):
        picked = rng.choice(units, size=len(units), replace=True)
        draws.append(_lifts(counts(np.concatenate([by_unit[u] for u in picked]))))
    draws = np.stack(draws)
    low, high = np.nanpercentile(draws, [2.5, 97.5], axis=0)
    with np.errstate(divide='ignore', invalid='ignore'):
        spread = np.nanstd(np.log(np.maximum(draws, 1e-3)), axis=0)
        z = np.log(np.maximum(observed, 1e-3)) / np.maximum(spread, 1e-9)
    p = norm.sf(z)
    out = []
    for i, ga_name in enumerate(keep_a):
        for j, gb_name in enumerate(keep_b):
            if np.isfinite(observed[i, j]):
                out.append({'from': ga_name, 'to': gb_name, 'lift': round(float(observed[i, j]), 3),
                            'low': round(float(low[i, j]), 3), 'high': round(float(high[i, j]), 3),
                            'p': float(p[i, j])})
    return out


def adjust(rows: list[dict]) -> list[dict]:
    """Benjamini–Hochberg q-values, in place, across every row given."""
    if not rows:
        return rows
    p = np.array([r['p'] for r in rows])
    order = np.argsort(p)
    ranked = p[order] * len(p) / np.arange(1, len(p) + 1)
    q = np.minimum(np.minimum.accumulate(ranked[::-1])[::-1], 1)
    for position, value in zip(order, q):
        rows[position]['q'] = float(value)
    return rows


def clear(row: dict) -> bool:
    return row['q'] < ALPHA and row['low'] > 1


def strongest(rows: list[dict], top: int = 3) -> list[dict]:
    """Per group of A, the groups of B it leans to, only where the link survives `clear`."""
    kept = [r for r in rows if clear(r)]
    out = []
    for name in dict.fromkeys(r['from'] for r in kept):
        mine = sorted((r for r in kept if r['from'] == name), key=lambda r: -r['lift'])
        out += [{**r, 'p': round(r['p'], 6), 'q': round(r['q'], 5)} for r in mine[:top]]
    return out
