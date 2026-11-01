"""Metrics a-d from RULES.md. `euclid` picks Euclidean neighbours (reduced spaces) over cosine (aligned)."""
from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.metrics import adjusted_rand_score

from ml.atlas import align, space, stability

K = 15
MIXED_SHARE = 0.2


def sims(a: np.ndarray, b: np.ndarray, euclid: bool) -> np.ndarray:
    """Higher is nearer: cosine for unit vectors, negative squared distance otherwise."""
    dot = a @ b.T
    if not euclid:
        return dot
    return 2 * dot - (b * b).sum(axis=1)[None, :] - (a * a).sum(axis=1)[:, None]


def neighbours(x: np.ndarray, queries: np.ndarray, euclid: bool, chunk: int = 2000) -> np.ndarray:
    """The K nearest other rows of x for each query row (indices into x)."""
    x = x.astype(np.float32)
    out = np.empty((len(queries), K), dtype=np.int64)
    for s in range(0, len(queries), chunk):
        q = queries[s:s + chunk]
        sim = sims(x[q], x, euclid)
        sim[np.arange(len(q)), q] = -np.inf
        part = np.argpartition(-sim, K, axis=1)[:, :K]
        out[s:s + chunk] = part
    return out


def knn_overlap(reference: np.ndarray, reduced: np.ndarray) -> float:
    hits = [len(np.intersect1d(a, b, assume_unique=True)) for a, b in zip(reference, reduced)]
    return round(float(np.mean(hits)) / K, 4)


def trust(aligned: np.ndarray, reduced: np.ndarray, rows: np.ndarray) -> float:
    from sklearn.manifold import trustworthiness
    return round(float(trustworthiness(aligned[rows], reduced[rows], n_neighbors=K, metric='cosine')), 4)


def retention(frame: pd.DataFrame, x: np.ndarray, euclid: bool) -> dict[str, float]:
    """align.retention_accuracy with a choice of neighbour metric; same sampling and seed."""
    rng = np.random.default_rng(align.SEED)
    out = {}
    for corpus in align.GROUPED:
        rows = np.flatnonzero(frame.corpus.to_numpy() == corpus)
        groups, units = frame.group.to_numpy()[rows], frame.unit.astype(str).to_numpy()[rows]
        picked = rng.choice(len(rows), size=min(align.SAMPLE, len(rows)), replace=False)
        sim = sims(x[rows[picked]], x[rows], euclid)
        sim[units[picked][:, None] == units[None, :]] = -np.inf
        nearest = np.argpartition(-sim, align.NEIGHBOURS, axis=1)[:, :align.NEIGHBOURS]
        votes = [pd.Series(groups[n]).value_counts().index[0] for n in nearest]
        out[corpus] = round(float((np.array(votes) == groups[picked]).mean()), 4)
    return out


def purity(frame: pd.DataFrame, x: np.ndarray, euclid: bool) -> float:
    """space.purity's overall value: share of 15 neighbours from the passage's own corpus."""
    rng = np.random.default_rng(space.SEED)
    rows = rng.choice(len(frame), size=min(space.SAMPLE, len(frame)), replace=False)
    corpus = frame.corpus.to_numpy()
    nearest = neighbours(x, rows, euclid)
    return round(float((corpus[nearest] == corpus[rows][:, None]).mean()), 4)


def clustering(frame: pd.DataFrame, runs: list[np.ndarray]) -> dict:
    """Stability over seeds 0-2: a seed-0 cluster is stable with Jaccard >= 0.5 in both others."""
    reference = runs[0]
    matches = [stability.best_jaccard(reference, o) for o in runs[1:]]
    stable = sorted(c for c in matches[0] if all(m[c] >= stability.JACCARD for m in matches))
    shared = np.all(np.stack(runs) >= 0, axis=0)
    ari = [float(adjusted_rand_score(reference[shared], o[shared])) if shared.any() else float('nan')
           for o in runs[1:]]
    kept = np.where(np.isin(reference, stable), reference, -1)
    corpus = frame.corpus.to_numpy()
    mixed = sum((pd.Series(corpus[kept == c]).value_counts(normalize=True) >= MIXED_SHARE).sum() >= 2
                for c in stable)
    return {'clusters': len(matches[0]), 'stable': len(stable),
            'noise': round(float((kept == -1).mean()), 4),
            'noise_raw': round(float((reference == -1).mean()), 4),
            'ari': round(float(np.mean(ari)), 4), 'ari_each': [round(a, 4) for a in ari],
            'mixed': int(mixed)}


def ratio(kept: dict[str, float], base: dict[str, float]) -> float:
    return round(float(np.mean([kept[c] / base[c] for c in kept])), 4)


def demo() -> None:
    """Self-check: an identity 'reduction' preserves every neighbour."""
    rng = np.random.default_rng(0)
    x = space.normalise(rng.normal(size=(300, 8))).astype(np.float32)
    q = np.arange(300)
    a, b = neighbours(x, q, False), neighbours(x, q, True)   # cosine == Euclidean order on the sphere
    assert knn_overlap(a, b) == 1.0
    labels = np.repeat([0, 1, -1], 100)
    f = pd.DataFrame({'corpus': ['a'] * 150 + ['b'] * 150})
    got = clustering(f, [labels, labels, labels])
    assert got['stable'] == 2 and got['ari'] == 1.0 and got['mixed'] == 1, got


if __name__ == '__main__':
    demo()
    print('ok')
