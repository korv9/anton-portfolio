"""Shared measures for a clustering. Each returns plain numbers so runs compare across domains.

The measures answer separate questions and are reported side by side, never summed:
- structure: how many groups, how large, how much noise;
- stability: whether other seeds and resamples find the same groups (ARI, noise excluded);
- separation: silhouette in the space that was clustered *and* in the original embedding space
  (the 2-D map is never used, a tidy map is not evidence);
- dominance: how far groups follow a confounder (work, book, employer, speaker), against a null
  that shuffles the labels while keeping the group sizes.
"""
from __future__ import annotations

from itertools import combinations

import numpy as np
from sklearn.metrics import adjusted_mutual_info_score, adjusted_rand_score, silhouette_score


def structure(labels: np.ndarray) -> dict:
    labels = np.asarray(labels)
    assigned = labels[labels >= 0]
    sizes = np.bincount(assigned) if len(assigned) else np.array([], dtype=int)
    sizes = sizes[sizes > 0]
    return {
        'observations': int(len(labels)),
        'cluster_count': int(len(sizes)),
        'noise_share': float((labels < 0).mean()) if len(labels) else 0.0,
        'coverage': float((labels >= 0).mean()) if len(labels) else 0.0,
        'largest_cluster_share': float(sizes.max() / len(labels)) if len(sizes) else 0.0,
        'median_cluster_size': float(np.median(sizes)) if len(sizes) else 0.0,
        'smallest_cluster_size': int(sizes.min()) if len(sizes) else 0,
    }


def pair_ari(a: np.ndarray, b: np.ndarray) -> float | None:
    """ARI over observations both labelings assign; None when too few remain."""
    both = (a >= 0) & (b >= 0)
    if both.sum() < 2 or len(set(a[both])) < 2:
        return None
    return float(adjusted_rand_score(a[both], b[both]))


def seed_stability(labelings: list[np.ndarray]) -> dict:
    """Agreement between fits that differ only in seed, all on the same observations."""
    values = [v for a, b in combinations(labelings, 2) if (v := pair_ari(a, b)) is not None]
    if not values:
        return {'pairs': 0, 'ari_mean': None, 'ari_min': None}
    return {'pairs': len(values), 'ari_mean': float(np.mean(values)), 'ari_min': float(np.min(values)),
            'noise_excluded': True}


def resample_stability(full: np.ndarray, resamples: list[tuple[np.ndarray, np.ndarray]]) -> dict:
    """Agreement of the full fit with refits on subsamples: [(indices into full, labels of refit)]."""
    values = [v for idx, labels in resamples if (v := pair_ari(full[idx], labels)) is not None]
    if not values:
        return {'resamples': 0, 'ari_mean': None, 'ari_p05': None}
    return {'resamples': len(values), 'ari_mean': float(np.mean(values)),
            'ari_p05': float(np.percentile(values, 5)), 'noise_excluded': True}


def separation(vectors: np.ndarray, labels: np.ndarray, metric: str, sample: int = 5000,
               seed: int = 0) -> float | None:
    """Silhouette on a fixed sample of assigned observations; None with fewer than two groups."""
    keep = np.flatnonzero(labels >= 0)
    if len(keep) > sample:
        keep = np.sort(np.random.default_rng(seed).choice(keep, sample, replace=False))
    if len(set(labels[keep])) < 2 or len(keep) <= len(set(labels[keep])):
        return None
    return float(silhouette_score(vectors[keep], labels[keep], metric=metric))


def dominance(labels: np.ndarray, field: np.ndarray, nulls: int = 200, seed: int = 0) -> dict:
    """How far groups follow one metadata field, with a size-preserving shuffle null.

    weighted_top_share: share of assigned observations whose group's most common value they share.
    The null keeps every group's size and shuffles which observations are in it, so it shows the
    share expected from the field's own distribution alone.
    """
    labels, field = np.asarray(labels), np.asarray(field).astype(str)
    keep = labels >= 0
    if keep.sum() < 2 or len(set(labels[keep])) < 2:
        return {'weighted_top_share': None, 'ami': None, 'null_top_share_p95': None}
    lab, val = labels[keep], field[keep]

    def top_share(values: np.ndarray) -> float:
        total = 0
        for c in np.unique(lab):
            _, counts = np.unique(values[lab == c], return_counts=True)
            total += counts.max()
        return total / len(lab)

    rng = np.random.default_rng(seed)
    null = [top_share(rng.permutation(val)) for _ in range(nulls)]
    observed = top_share(val)
    return {'weighted_top_share': float(observed),
            'ami': float(adjusted_mutual_info_score(lab, val)),
            'null_top_share_p95': float(np.percentile(null, 95)),
            'null_top_share_median': float(np.median(null)),
            'groups_majority_one_value': int(sum(
                np.unique(val[lab == c], return_counts=True)[1].max() / (lab == c).sum() > 0.5
                for c in np.unique(lab)))}


def neighbour_share(vectors: np.ndarray, field: np.ndarray, k: int = 10, sample: int = 3000,
                    seed: int = 0) -> dict:
    """Share of each observation's k cosine neighbours that share its field value, vs chance."""
    field = np.asarray(field).astype(str)
    rng = np.random.default_rng(seed)
    idx = rng.choice(len(vectors), min(sample, len(vectors)), replace=False)
    vectors = np.asarray(vectors, dtype=np.float32)
    unit = vectors / np.maximum(np.linalg.norm(vectors, axis=1, keepdims=True), 1e-12)
    sims = unit[idx] @ unit.T
    sims[np.arange(len(idx)), idx] = -np.inf
    near = np.argpartition(-sims, k, axis=1)[:, :k]
    same = (field[near] == field[idx][:, None]).mean()
    _, counts = np.unique(field, return_counts=True)
    chance = float(((counts / counts.sum()) ** 2).sum())
    return {'k': k, 'same_share': float(same), 'chance': chance}
