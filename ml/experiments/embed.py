"""Embedding cache keyed by text hash, model revision and preprocessing version.

The cache folder name is a hash of (model, revision, text version, prefix), so changing any of them
starts a new cache and never mixes vectors. Inside, each written batch is one Parquet shard of
(text_hash, vector); a rerun reads the shards, embeds only missing hashes and appends new shards,
so an interrupted run resumes. Identical texts are embedded once.
"""
from __future__ import annotations

import hashlib
import os
from pathlib import Path

import numpy as np
import pandas as pd

from ml.cluster_lab.io import atomic_json, digest

_REPRO = os.environ.get('EXPERIMENTS_REPRO', '').strip()
ROOT = (Path(os.environ.get('PORTFOLIO_FEATURES') or Path(__file__).resolve().parents[2] / 'warehouse' / 'features')
        / 'experiments' / (f'embeddings-repro-{_REPRO}' if _REPRO else 'embeddings'))


def text_hash(text: str, text_version: str) -> str:
    return hashlib.sha256(f'{text_version}\n{text}'.encode()).hexdigest()


def cache_key(model: str, revision: str, text_version: str, prefix: str = '') -> str:
    return digest({'model': model, 'revision': revision, 'text_version': text_version, 'prefix': prefix})[:16]


def cached(folder: Path) -> pd.DataFrame:
    shards = sorted(folder.glob('shard-*.parquet'))
    if not shards:
        return pd.DataFrame({'text_hash': pd.Series(dtype=str), 'vector': pd.Series(dtype=object)})
    return pd.concat([pd.read_parquet(s) for s in shards], ignore_index=True).drop_duplicates('text_hash')


def embed(texts: list[str], hashes: list[str], model: str, revision: str, text_version: str,
          prefix: str = '', batch: int = 2048, device: str | None = None, root: Path = ROOT,
          encoder=None, deadline=None) -> np.ndarray:
    """Vectors for `texts` in order. `encoder(list[str]) -> ndarray` replaces the model in tests.
    Raises TimeoutError when `deadline.expired()` before all texts are embedded (shards are kept)."""
    if not revision:
        raise ValueError('pin the model revision: an unpinned model could change under the cache')
    folder = root / cache_key(model, revision, text_version, prefix)
    folder.mkdir(parents=True, exist_ok=True)
    atomic_json(folder / 'key.json', {'model': model, 'revision': revision, 'text_version': text_version,
                                      'prefix': prefix})
    have = cached(folder)
    known = set(have.text_hash)
    todo = {}
    for t, h in zip(texts, hashes):
        if h not in known and h not in todo:
            todo[h] = t
    if todo and encoder is None:
        from sentence_transformers import SentenceTransformer
        import torch
        st = SentenceTransformer(model, revision=revision,
                                 device=device or ('cuda' if torch.cuda.is_available() else 'cpu'))
        encoder = lambda xs: st.encode([prefix + x for x in xs], batch_size=32, normalize_embeddings=True,
                                       convert_to_numpy=True, show_progress_bar=False)
    items = list(todo.items())
    start = len(list(folder.glob('shard-*.parquet')))
    for n, i in enumerate(range(0, len(items), batch)):
        if deadline is not None and deadline.expired():
            raise TimeoutError(f'{len(items) - i} texts left to embed; rerun to resume')
        part = items[i:i + batch]
        vectors = np.asarray(encoder([t for _, t in part]), dtype=np.float32)
        shard = pd.DataFrame({'text_hash': [h for h, _ in part], 'vector': list(vectors)})
        tmp = folder / f'shard-{start + n:05d}.parquet.tmp'
        shard.to_parquet(tmp)
        os.replace(tmp, folder / f'shard-{start + n:05d}.parquet')
    table = cached(folder).set_index('text_hash')
    return np.stack(table.loc[list(hashes), 'vector'].to_numpy()).astype(np.float32)
