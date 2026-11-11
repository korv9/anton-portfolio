"""Sentence embeddings shared across corpora, computed locally on the CPU.

One model for every cross-corpus comparison, so vectors are always comparable:
sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2 (384 dimensions), which reads
Swedish and English. Vectors are L2-normalised, so cosine similarity is a dot product. No text
leaves the machine and no vector is delivered to the site. (The Symbolic Atlas keeps its own
English model, MODEL in nlp/symbolic/embeddings.py; its vectors are never compared with these.)
"""
from __future__ import annotations

import numpy as np

MULTILINGUAL = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
BATCH = 64
# Models trained with an instruction prefix (e5: "query: " for symmetric tasks such as clustering).
PREFIX = {"intfloat/e5-base-v2": "query: "}


def embed(texts: list[str], model_name: str = MULTILINGUAL) -> np.ndarray:
    from sentence_transformers import SentenceTransformer

    model = SentenceTransformer(model_name, device="cpu")
    prefix = PREFIX.get(model_name, "")
    vectors = model.encode([prefix + t for t in texts] if prefix else texts, batch_size=BATCH, normalize_embeddings=True,
                           show_progress_bar=False, convert_to_numpy=True)
    return vectors.astype(np.float32)


def top_k(similarity: np.ndarray, k: int) -> tuple[np.ndarray, np.ndarray]:
    """Per row, the indices and values of the k largest entries, largest first."""
    k = min(k, similarity.shape[1])
    index = np.argpartition(-similarity, k - 1, axis=1)[:, :k]
    values = np.take_along_axis(similarity, index, axis=1)
    order = np.argsort(-values, axis=1)
    return np.take_along_axis(index, order, axis=1), np.take_along_axis(values, order, axis=1)
