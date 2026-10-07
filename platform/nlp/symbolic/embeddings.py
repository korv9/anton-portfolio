"""Sentence embeddings of each occurrence's context, computed locally.

The model is sentence-transformers/all-MiniLM-L6-v2 (384 dimensions), run on the CPU; no text
leaves the machine. Vectors are L2-normalised, so cosine similarity is a dot product. They are
a local artefact (warehouse/features/symbolic/occurrence_embeddings.parquet), never delivered
to the site.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np

MODEL = "sentence-transformers/all-MiniLM-L6-v2"
BATCH = 64
# Models trained with an instruction prefix (e5: "query: " for symmetric tasks such as clustering).
PREFIX = {"intfloat/e5-base-v2": "query: "}


def embed(texts: list[str], model_name: str = MODEL) -> np.ndarray:
    from sentence_transformers import SentenceTransformer

    model = SentenceTransformer(model_name, device="cpu")
    prefix = PREFIX.get(model_name, "")
    vectors = model.encode([prefix + t for t in texts] if prefix else texts, batch_size=BATCH, normalize_embeddings=True,
                           show_progress_bar=False, convert_to_numpy=True)
    return vectors.astype(np.float32)


def write(path: Path, ids: list[str], vectors: np.ndarray) -> None:
    import pyarrow as pa
    import pyarrow.parquet as pq

    path.parent.mkdir(parents=True, exist_ok=True)
    table = pa.table({
        "occurrence_id": pa.array(ids, pa.string()),
        "embedding": pa.FixedSizeListArray.from_arrays(
            pa.array(vectors.reshape(-1), pa.float32()), vectors.shape[1]),
    })
    pq.write_table(table, path)
