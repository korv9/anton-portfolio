"""One candidate pipeline fitted over several seeds and measured the shared way.

`evaluate_candidate` takes embedding vectors, a representation step, a reduction and a
clustering, fits it once per seed, and returns labels of the first seed plus the shared metrics:
structure, seed stability, separation in the clustered space and in the representation space,
and dominance of every confounder field. The 2-D map is made elsewhere and never measured here.
"""
from __future__ import annotations

import numpy as np

from . import evaluate as ev


def normalise(x: np.ndarray) -> np.ndarray:
    return x / np.maximum(np.linalg.norm(x, axis=1, keepdims=True), 1e-12)


def represent(vectors: np.ndarray, kind: str, groups=None) -> np.ndarray:
    """raw: as embedded. centred: each group's mean subtracted, then re-normalised."""
    vectors = normalise(np.asarray(vectors, dtype=np.float32))
    if kind == 'raw':
        return vectors
    if kind == 'centred':
        groups = np.asarray(groups).astype(str)
        out = vectors.copy()
        for g in np.unique(groups):
            m = groups == g
            out[m] -= out[m].mean(axis=0)
        return normalise(out)
    raise ValueError(f'unknown representation {kind}')


def reduce(x: np.ndarray, spec: dict, seed: int) -> np.ndarray:
    kind = spec.get('kind', 'none')
    if kind == 'none':
        return x
    if kind == 'pca':
        from sklearn.decomposition import PCA
        return PCA(spec['dims'], random_state=seed).fit_transform(x)
    if kind == 'umap':
        import umap
        return umap.UMAP(n_components=spec['dims'], n_neighbors=spec.get('neighbors', 15),
                         min_dist=spec.get('min_dist', 0.0), metric=spec.get('metric', 'cosine'),
                         random_state=seed, low_memory=True).fit_transform(x)
    raise ValueError(f'unknown reduction {kind}')


def cluster(space: np.ndarray, spec: dict, seed: int) -> np.ndarray:
    method = spec['method']
    if method == 'hdbscan':
        from sklearn.cluster import HDBSCAN
        mcs = spec['min_cluster_size']
        if isinstance(mcs, float) and mcs < 1:
            mcs = max(5, int(round(mcs * len(space))))
        # max_cluster_size is a share of the observations, as in the published debate run (0.1).
        cap = spec.get('max_cluster_share')
        return HDBSCAN(min_cluster_size=mcs, min_samples=spec.get('min_samples'),
                       max_cluster_size=int(cap * len(space)) if cap else None,
                       cluster_selection_method=spec.get('selection', 'eom'), copy=True).fit_predict(space)
    if method == 'kmeans':
        from sklearn.cluster import KMeans
        return KMeans(spec['k'], n_init=4, random_state=seed).fit_predict(space)
    raise ValueError(f'unknown clustering {method}')


def evaluate_candidate(vectors: np.ndarray, pipeline: dict, seeds: list[int], confounders: dict,
                       groups_for_centring=None) -> tuple[np.ndarray, np.ndarray, dict]:
    """Returns (labels of the first seed, clustered space of the first seed, metrics)."""
    rep = represent(vectors, pipeline['representation']['kind'], groups_for_centring)
    labelings, first_space = [], None
    for seed in seeds:
        space = reduce(rep, pipeline['reduction'], seed)
        labelings.append(cluster(space, pipeline['clustering'], seed))
        if first_space is None:
            first_space = space
    labels = labelings[0]
    metrics = ev.structure(labels)
    metrics['seed_stability'] = ev.seed_stability(labelings)
    metrics['separation_clustered'] = ev.separation(first_space, labels, 'euclidean')
    metrics['separation_representation'] = ev.separation(rep, labels, 'cosine')
    metrics['dominance'] = {name: ev.dominance(labels, values) for name, values in confounders.items()}
    metrics['seed_noise_shares'] = [float((l < 0).mean()) for l in labelings]
    metrics['seed_cluster_counts'] = [int(len(set(l[l >= 0]))) for l in labelings]
    return labels, first_space, metrics
