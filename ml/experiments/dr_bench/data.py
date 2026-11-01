"""The aligned space and the fixed subsample, built once from the embedding cache (no re-embedding)."""
from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

from ml.atlas import build, space

OUT = build.corpora.ROOT / 'tmp/dr-bench'
SAMPLE, TRUST = 20000, 5000


def aligned() -> tuple[pd.DataFrame, np.ndarray]:
    """Frame and whiten-ledoit-wolf vectors for all 77,753 passages, cached as float32."""
    frame = pd.read_parquet(build.WORK / 'passages.parquet', columns=['corpus', 'language', 'group', 'unit'])
    path = OUT / 'aligned.npy'
    if not path.exists():
        vectors = space.normalise(np.load(build.WORK / 'vectors.npy'))
        OUT.mkdir(parents=True, exist_ok=True)
        np.save(path, space.whiten(frame, vectors, shrink=None).astype(np.float32))
    return frame, np.load(path)


def _stratified(corpus: np.ndarray, size: int) -> np.ndarray:
    from sklearn.model_selection import train_test_split

    rows, _ = train_test_split(np.arange(len(corpus)), train_size=size, stratify=corpus, random_state=0)
    return np.sort(rows)


def sample(frame: pd.DataFrame) -> tuple[np.ndarray, np.ndarray]:
    """20k rows (indices into the full frame) and 5k positions within them for trustworthiness."""
    path = OUT / 'sample.npy'
    if not path.exists():
        np.save(path, _stratified(frame.corpus.to_numpy(), SAMPLE))
    rows = np.load(path)
    trust = _stratified(frame.corpus.to_numpy()[rows], TRUST)
    return rows, trust


def load(full: bool) -> tuple[pd.DataFrame, np.ndarray, np.ndarray, np.ndarray]:
    """(frame of the fitted rows, aligned vectors of those rows, query positions, trust positions).

    Query positions are the rows kNN preservation is measured for: all 20k on the subsample,
    the 20k sample rows inside the full set otherwise.
    """
    frame, vectors = aligned()
    rows, trust = sample(frame)
    if full:
        return frame.reset_index(drop=True), vectors, rows, rows[trust]
    return frame.iloc[rows].reset_index(drop=True), vectors[rows], np.arange(len(rows)), trust


def path(name: str) -> Path:
    OUT.mkdir(parents=True, exist_ok=True)
    return OUT / name
