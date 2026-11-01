"""Every reduction and clustering in the benchmark. Seeds go to the DR method, as in production."""
from __future__ import annotations

import numpy as np

from ml.atlas import space

THREADS = 4
TEN = ('umap10', 'umap10-pre', 'pca50', 'pacmap10', 'localmap10', 'densmap10')
TWO = ('umap2', 'tsne2', 'pacmap2', 'localmap2', 'phate2', 'torchdr-umap2')


def exact_knn(x: np.ndarray, k: int = 15) -> tuple[np.ndarray, np.ndarray]:
    """Brute-force cosine k-NN including self first, in the (indices, distances) form UMAP takes."""
    idx = space.top_k(x, x, k)
    idx[:, 0] = np.arange(len(x))   # self first even when an exact duplicate ties with it
    dist = np.maximum(1 - np.einsum('nd,nkd->nk', x, x[idx]), 0)
    dist[:, 0] = 0
    return idx, dist.astype(np.float32)


def reduce(name: str, x: np.ndarray, seed: int, knn=None) -> np.ndarray:
    import umap

    if name in ('umap10', 'umap10-pre', 'densmap10'):
        return umap.UMAP(n_components=10, n_neighbors=15, min_dist=0.0, metric='cosine',
                         densmap=name == 'densmap10', random_state=seed,
                         precomputed_knn=knn if name == 'umap10-pre' else (None, None, None)
                         ).fit_transform(x)
    if name == 'umap2':
        return umap.UMAP(n_components=2, n_neighbors=30, min_dist=0.1, metric='cosine',
                         random_state=seed).fit_transform(x)
    if name == 'pca50':
        from sklearn.decomposition import PCA
        return PCA(50, random_state=seed).fit_transform(x)
    if name.startswith(('pacmap', 'localmap')):
        import pacmap
        cls = pacmap.LocalMAP if name.startswith('localmap') else pacmap.PaCMAP
        dims = int(''.join(c for c in name if c.isdigit()))
        return cls(n_components=dims, random_state=seed).fit_transform(x)
    if name == 'tsne2':
        from openTSNE import TSNE
        return np.asarray(TSNE(perplexity=30, metric='cosine', n_jobs=THREADS,
                               negative_gradient_method='fft', random_state=seed).fit(x))
    if name == 'phate2':
        import phate
        return phate.PHATE(n_components=2, n_jobs=THREADS, random_state=seed, verbose=0).fit_transform(x)
    if name == 'torchdr-umap2':
        import torch
        import torchdr
        out = torchdr.UMAP(n_neighbors=30, min_dist=0.1, device='cuda', backend=None,
                           random_state=seed).fit_transform(torch.from_numpy(x))
        return out.detach().cpu().numpy() if hasattr(out, 'detach') else np.asarray(out)
    raise ValueError(name)


def hdbscan_labels(y: np.ndarray, min_cluster: int, min_samples: int) -> np.ndarray:
    import hdbscan
    return hdbscan.HDBSCAN(min_cluster_size=min_cluster, min_samples=min_samples,
                           core_dist_n_jobs=THREADS).fit_predict(y)


def plscan_labels(y: np.ndarray, min_cluster: int, min_samples: int) -> np.ndarray:
    from fast_plscan import PLSCAN
    return np.asarray(PLSCAN(min_samples=min_samples, min_cluster_size=min_cluster,
                             num_threads=THREADS).fit(y).labels_)


def evoc_labels(x: np.ndarray, seed: int) -> tuple[np.ndarray, list[dict]]:
    """EVoC's own labels_ (highest-persistence layer, chosen without labels) and every layer."""
    import evoc
    model = evoc.EVoC(random_state=seed)
    labels = np.asarray(model.fit_predict(x))
    layers = [{'clusters': int(len(set(l.tolist()) - {-1})), 'noise': round(float((l == -1).mean()), 4),
               'persistence': round(float(p), 4)}
              for l, p in zip(model.cluster_layers_, model.persistence_scores_)]
    return labels, layers
