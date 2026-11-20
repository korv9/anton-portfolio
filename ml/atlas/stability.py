"""Cluster stability across seeds, and the clustering itself.

UMAP with a fixed seed runs on one core, so the seeds run side by side in separate processes
instead: same result as running them one after another, about as fast as one. Seed 0 is the
reference. A seed-0 cluster is stable when its best match in another run has Jaccard of at least
JACCARD in at least AGREE of the other runs; the rest are published as noise.
"""
from __future__ import annotations

from concurrent.futures import ProcessPoolExecutor

import numpy as np
from sklearn.metrics import adjusted_rand_score

SEEDS = (0, 1, 2, 3, 4)
JACCARD = 0.5
AGREE = 3
WORKERS = 3   # each UMAP holds a few GB; 16 GB of memory fits three at once


def labels(space: np.ndarray, seed: int, min_cluster_size: int, min_samples: int) -> np.ndarray:
    import hdbscan
    import umap

    reduced = umap.UMAP(n_components=10, n_neighbors=15, min_dist=0.0, metric='cosine',
                        random_state=seed).fit_transform(space)
    return hdbscan.HDBSCAN(min_cluster_size=min_cluster_size,
                           min_samples=min_samples).fit_predict(reduced)


def layout(space: np.ndarray, seed: int = 0) -> np.ndarray:
    import umap

    return umap.UMAP(n_components=2, n_neighbors=30, min_dist=0.1, metric='cosine',
                     random_state=seed).fit_transform(space)


def run(space: np.ndarray, min_cluster_size: int, min_samples: int) -> tuple[list[np.ndarray], np.ndarray]:
    """Labels for every seed and the 2-d map, all in parallel."""
    with ProcessPoolExecutor(max_workers=WORKERS) as pool:
        jobs = [pool.submit(labels, space, s, min_cluster_size, min_samples) for s in SEEDS]
        flat = pool.submit(layout, space)
        return [j.result() for j in jobs], flat.result()


def best_jaccard(reference: np.ndarray, other: np.ndarray) -> dict[int, float]:
    sizes = np.bincount(other[other >= 0]) if (other >= 0).any() else np.zeros(0)
    out = {}
    for c in sorted(set(reference.tolist()) - {-1}):
        members = other[reference == c]
        overlap = np.bincount(members[members >= 0], minlength=len(sizes))
        union = (reference == c).sum() + sizes - overlap
        out[c] = float((overlap / np.maximum(union, 1)).max()) if len(sizes) else 0.0
    return out


def stability(runs: list[np.ndarray]) -> dict:
    reference, others = runs[0], runs[1:]
    matches = [best_jaccard(reference, o) for o in others]
    agree = {c: sum(m[c] >= JACCARD for m in matches) for c in matches[0]}
    shared = np.all(np.stack(runs) >= 0, axis=0)
    ari = [round(float(adjusted_rand_score(reference[shared], o[shared])), 4) for o in others]
    return {'stable': sorted(c for c, n in agree.items() if n >= AGREE),
            'agree': agree, 'median_jaccard': {c: round(float(np.median([m[c] for m in matches])), 3)
                                               for c in agree},
            'ari': ari}


def keep_stable(reference: np.ndarray, stable: list[int]) -> np.ndarray:
    return np.where(np.isin(reference, stable), reference, -1)
