"""One shared space: centring, its diagnostics, and the clustering.

A multilingual model puts language and genre on its strongest axes, so raw vectors sort first by
corpus and say little across corpora. Centring each corpus (and each language within the AI Act)
on its own mean was not enough: 94% of a passage's neighbours still came from its own corpus. So
each is whitened instead: centred, then rescaled so its own directions of variation have equal
weight (ZCA, covariance shrunk 10% toward the identity). A law's legal register stops dominating,
and what is left is how a passage differs from others of its kind. The rule for choosing, fixed
before looking at clusters: the lowest corpus purity whose translation match is no worse than
centring alone. Two checks report what it did:

  corpus purity       share of a passage's nearest neighbours from its own corpus, raw against
                      centred, with the share a random neighbour would give
  translation match   for each Swedish AI Act paragraph, is its English original the nearest
                      English paragraph? Centring should help, since only language differs
"""
from __future__ import annotations

import numpy as np
import pandas as pd

NEIGHBOURS = 15
SAMPLE = 6000
SEED = 0


def normalise(x: np.ndarray) -> np.ndarray:
    return x / np.maximum(np.linalg.norm(x, axis=1, keepdims=True), 1e-12)


def centre(frame: pd.DataFrame, vectors: np.ndarray) -> np.ndarray:
    out = vectors.copy()
    for _, rows in frame.groupby(frame.corpus + ':' + frame.language).indices.items():
        out[rows] -= out[rows].mean(axis=0)
    return normalise(out)


SHRINK = 0.1


def whiten(frame: pd.DataFrame, vectors: np.ndarray, shrink: float = SHRINK) -> np.ndarray:
    out = np.empty_like(vectors)
    for _, rows in frame.groupby(frame.corpus + ':' + frame.language).indices.items():
        x = vectors[rows] - vectors[rows].mean(axis=0)
        cov = np.cov(x, rowvar=False)
        cov = (1 - shrink) * cov + shrink * np.trace(cov) / len(cov) * np.eye(len(cov))
        values, basis = np.linalg.eigh(cov)
        out[rows] = x @ basis @ np.diag(values ** -0.5) @ basis.T
    return normalise(out)


def top_k(queries: np.ndarray, pool: np.ndarray, k: int, chunk: int = 2048,
          exclude_self: bool = False) -> np.ndarray:
    """Indices of the k most similar rows of `pool` for each query, by cosine (inputs normalised)."""
    out = np.empty((len(queries), k), dtype=np.int64)
    for start in range(0, len(queries), chunk):
        sims = queries[start:start + chunk] @ pool.T
        if exclude_self:
            sims[np.arange(len(sims)), np.arange(start, start + len(sims))] = -np.inf
        part = np.argpartition(-sims, k, axis=1)[:, :k]
        order = np.take_along_axis(sims, part, axis=1).argsort(axis=1)[:, ::-1]
        out[start:start + chunk] = np.take_along_axis(part, order, axis=1)
    return out


def purity(frame: pd.DataFrame, space: np.ndarray) -> dict:
    rng = np.random.default_rng(SEED)
    rows = rng.choice(len(frame), size=min(SAMPLE, len(frame)), replace=False)
    corpus = frame.corpus.to_numpy()
    sims = space[rows] @ space.T
    sims[np.arange(len(rows)), rows] = -np.inf
    nearest = np.argpartition(-sims, NEIGHBOURS, axis=1)[:, :NEIGHBOURS]
    same = (corpus[nearest] == corpus[rows][:, None]).mean(axis=1)
    shares = frame.corpus.value_counts(normalize=True)
    by = {c: round(float(same[corpus[rows] == c].mean()), 4) for c in shares.index}
    return {'overall': round(float(same.mean()), 4), 'by_corpus': by,
            'random': round(float((shares ** 2).sum()), 4)}


def translation_match(frame: pd.DataFrame, space: np.ndarray) -> dict | None:
    act = frame[frame.corpus == 'ai_act']
    key = act.item_id.str[3:]   # 'sv:art_5:2' and 'en:art_5:2' share 'art_5:2'
    sv, en = act.index[act.language == 'sv'], act.index[act.language == 'en']
    en_keys = key[en].to_numpy()
    sv = sv[np.isin(key[sv].to_numpy(), en_keys)]
    if not len(sv):
        return None
    best = top_k(space[sv], space[en], 1)[:, 0]
    hits = en_keys[best] == key[sv].to_numpy()
    return {'pairs': int(len(sv)), 'top1': round(float(hits.mean()), 4),
            'random': round(1 / len(en), 5)}


def cluster(space: np.ndarray, min_cluster_size: int, min_samples: int) -> tuple[np.ndarray, np.ndarray]:
    """UMAP to 10 dimensions for HDBSCAN, and a separate 2-D UMAP for the map."""
    import umap
    from sklearn.cluster import HDBSCAN

    reduced = umap.UMAP(n_components=10, n_neighbors=15, min_dist=0.0, metric='cosine',
                        random_state=SEED).fit_transform(space)
    labels = HDBSCAN(min_cluster_size=min_cluster_size, min_samples=min_samples).fit_predict(reduced)
    flat = umap.UMAP(n_components=2, n_neighbors=30, min_dist=0.1, metric='cosine',
                     random_state=SEED).fit_transform(space)
    return labels, flat
