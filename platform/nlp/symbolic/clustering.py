"""Lay the occurrences out in two dimensions and find clusters, without naming them.

- Map: UMAP to 2 dimensions on cosine distance (n_neighbors 15, min_dist 0.1, random_state 42).
- Clusters: UMAP to 10 dimensions (min_dist 0.0, which keeps dense regions dense), then
  HDBSCAN (scikit-learn) with min_cluster_size 20 and min_samples 10. Points HDBSCAN cannot
  place are noise (cluster -1). Clustering in 10 dimensions rather than on the 2-D map keeps
  the map's distortions out of the clusters.

Cluster ids are numbers. Nothing here knows what a cluster means.
"""
from __future__ import annotations

import numpy as np

MAP = {"n_components": 2, "n_neighbors": 15, "min_dist": 0.1, "metric": "cosine", "random_state": 42}
SPACE = {"n_components": 10, "n_neighbors": 15, "min_dist": 0.0, "metric": "cosine", "random_state": 42}
HDBSCAN = {"min_cluster_size": 20, "min_samples": 10, "metric": "euclidean"}


def reduce(vectors: np.ndarray, params: dict) -> np.ndarray:
    import umap

    return umap.UMAP(**params).fit_transform(vectors).astype(np.float32)


def cluster(space: np.ndarray, params: dict = HDBSCAN) -> tuple[np.ndarray, np.ndarray]:
    from sklearn.cluster import HDBSCAN as Model

    model = Model(**params).fit(space)
    return model.labels_.astype(int), model.probabilities_.astype(np.float32)
