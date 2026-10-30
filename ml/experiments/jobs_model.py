"""The job-ad pipeline as one saved artifact that can process ads it has never seen.

A model folder `warehouse/features/experiments/jobs/models/<run_id>/` holds:
- `model.joblib`: text version and cleaning parameters, embedding model and revision (or the fitted
  TF-IDF/SVD transformer), the fitted reducer (UMAP or PCA), the cluster labels of the training ads,
  per-cluster centroids in the reduced space with a distance radius, and centroids in the
  representation space (used to match clusters between versions);
- `manifest.json`: run_id, dataset_version, pipeline, training ids and the sha256 of every file.
`load` refuses a folder whose files do not match their manifest hashes.

Assignment between retrains (`assign`): a new ad is embedded and reduced with the saved transformers
and given the nearest centroid, but only when it lies within that cluster's radius, the RADIUS_QUANTILE
of the training members' own distances. Otherwise it gets -1, "fits no group". This works for HDBSCAN
and K-means alike and runs on CPU; the radius is calibrated on training data, so about
1 - RADIUS_QUANTILE of training members would themselves abstain.
"""
from __future__ import annotations

from pathlib import Path

import joblib
import numpy as np

from ml.cluster_lab.io import atomic_json, file_hash, now, read_json
from ml.jobs.embeddings import REPRESENTATION, encode_text_batch
from . import embed as cache
from .fit import cluster, normalise

RADIUS_QUANTILE = 0.95
EMBEDDINGS = {
    'minilm-l12': {'model': 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2',
                   'revision': 'e8f8c211226b894fcb81acc59f3b34ba3efd5f42', 'representation': REPRESENTATION},
    'kblab-sv': {'model': 'KBLab/sentence-bert-swedish-cased',
                 'revision': '6b5e83cd29c03729cfdc33d13b1423399b0efb5c', 'representation': REPRESENTATION},
    'tfidf-lsa': {'model': 'tfidf-lsa', 'revision': 'sklearn-tfidf-sublinear-minDf2-svd256-v1',
                  'representation': 'tfidf-svd256-normalised-v1'},
}


class ChunkEncoder:
    """Token-chunk mean encoder of ml/jobs, loaded on first use so cached runs never load the model."""

    def __init__(self, model: str, revision: str, device: str | None = None):
        self.model, self.revision, self.device, self.st = model, revision, device, None

    def __call__(self, texts: list[str]) -> np.ndarray:
        if self.st is None:
            import torch
            from sentence_transformers import SentenceTransformer
            self.st = SentenceTransformer(self.model, revision=self.revision,
                                          device=self.device or ('cuda' if torch.cuda.is_available() else 'cpu'))
        return encode_text_batch(self.st, texts)


def fit_tfidf(texts: list[str], seed: int = 0):
    from sklearn.decomposition import TruncatedSVD
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.pipeline import make_pipeline
    words = TfidfVectorizer(sublinear_tf=True, min_df=2, max_df=0.9, token_pattern=r'(?u)\b[^\W\d_]{2,}\b')
    counts = words.fit_transform(texts)
    svd = TruncatedSVD(min(256, counts.shape[0] - 1, counts.shape[1] - 1), random_state=seed).fit(counts)
    return make_pipeline(words, svd)


def encode(texts: list[str], hashes: list[str], text_version: str, key: str, transformer=None,
           root: Path = cache.ROOT, encoder=None, deadline=None):
    """(vectors, transformer). Sentence models go through the shared cache (per text hash, model revision,
    text version and pooling); TF-IDF is fitted here unless a fitted `transformer` is given."""
    spec = EMBEDDINGS[key]
    if key == 'tfidf-lsa':
        transformer = fit_tfidf(texts) if transformer is None else transformer
        return normalise(transformer.transform(texts).astype(np.float32)), transformer
    version = f"{text_version}+{spec['representation']}"
    vectors = cache.embed(texts, hashes, spec['model'], spec['revision'], version, root=root,
                          encoder=encoder or ChunkEncoder(spec['model'], spec['revision']), deadline=deadline)
    return vectors, None


def make_reducer(spec: dict, seed: int, n: int):
    """The fitted-object twin of fit.reduce, with the same parameters."""
    kind = spec.get('kind', 'none')
    if kind == 'none':
        return None
    if kind == 'pca':
        from sklearn.decomposition import PCA
        return PCA(spec['dims'], random_state=seed)
    if kind == 'umap':
        import umap
        return umap.UMAP(n_components=spec['dims'], n_neighbors=min(spec.get('neighbors', 15), n - 1),
                         min_dist=spec.get('min_dist', 0.0), metric=spec.get('metric', 'cosine'),
                         random_state=seed, low_memory=True)
    raise ValueError(f'unknown reduction {kind}')


def centroids(space: np.ndarray, labels: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    ids = np.array(sorted(set(labels[labels >= 0])), dtype=int)
    centres = np.stack([space[labels == c].mean(axis=0) for c in ids]) if len(ids) else np.zeros((0, space.shape[1]))
    return ids, centres


def train_abstain_share(space, ids, centres, radius) -> float:
    """Share of training ads (noise included) that the radius rule would leave unassigned."""
    if not len(ids):
        return 1.0
    dist = np.linalg.norm(space[:, None, :] - centres[None, :, :], axis=2)
    nearest = dist.argmin(axis=1)
    return float((dist[np.arange(len(space)), nearest] > radius[nearest]).mean())


def fit_model(vectors: np.ndarray, pipeline: dict, seed: int, transformer=None) -> dict:
    """Fit reducer and clusterer on training vectors; returns everything `assign` needs."""
    if pipeline['representation']['kind'] != 'raw':
        raise ValueError('only the raw representation can be applied to unseen ads (centring needs their group mean)')
    rep = normalise(np.asarray(vectors, dtype=np.float32))
    reducer = make_reducer(pipeline['reduction'], seed, len(rep))
    space = rep if reducer is None else reducer.fit_transform(rep)
    labels = cluster(space, pipeline['clustering'], seed)
    ids, centres = centroids(space, labels)
    radius = np.array([np.quantile(np.linalg.norm(space[labels == c] - centres[i], axis=1), RADIUS_QUANTILE)
                       for i, c in enumerate(ids)])
    _, rep_centres = centroids(rep, labels)
    return {'pipeline': pipeline, 'seed': seed, 'transformer': transformer, 'reducer': reducer,
            'labels': labels, 'cluster_ids': ids, 'centroids': centres, 'radius': radius,
            'rep_centroids': normalise(rep_centres) if len(ids) else rep_centres,
            'train_centre': normalise(rep.mean(axis=0, keepdims=True))[0],
            'train_cosine_to_centre': float((rep @ normalise(rep.mean(axis=0, keepdims=True))[0]).mean()),
            'train_abstain_share': train_abstain_share(space, ids, centres, radius),
            'radius_quantile': RADIUS_QUANTILE}


def assign(model: dict, vectors: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """(labels, distance to the nearest centroid) for unseen ads; -1 where the ad lies outside every radius."""
    rep = normalise(np.asarray(vectors, dtype=np.float32))
    if not len(model['cluster_ids']):
        return np.full(len(rep), -1), np.full(len(rep), np.inf)
    space = rep if model['reducer'] is None else model['reducer'].transform(rep)
    dist = np.linalg.norm(space[:, None, :] - model['centroids'][None, :, :], axis=2)
    nearest = dist.argmin(axis=1)
    best = dist[np.arange(len(rep)), nearest]
    labels = np.where(best <= model['radius'][nearest], model['cluster_ids'][nearest], -1)
    return labels.astype(int), best


def save(model: dict, folder: Path, manifest: dict) -> Path:
    """Write model.joblib and a manifest naming the run, the dataset and the sha256 of each file."""
    folder = Path(folder)
    folder.mkdir(parents=True, exist_ok=True)
    tmp = folder / 'model.joblib.tmp'
    joblib.dump(model, tmp, compress=3)
    tmp.replace(folder / 'model.joblib')
    body = {**manifest, 'created_at': now(), 'radius_quantile': model['radius_quantile'],
            'files': {'model.joblib': file_hash(folder / 'model.joblib')}}
    atomic_json(folder / 'manifest.json', body)
    return folder


def load(folder: Path) -> tuple[dict, dict]:
    folder = Path(folder)
    if not (folder / 'manifest.json').exists():
        raise FileNotFoundError(f'no model manifest in {folder}')
    manifest = read_json(folder / 'manifest.json')
    for name, sha in manifest['files'].items():
        if file_hash(folder / name) != sha:
            raise ValueError(f'{folder / name} does not match its manifest sha256')
    return joblib.load(folder / 'model.joblib'), manifest
