"""Transformations for the deconfounding experiments (experiments.py).

- mask_symbol: replace the matched symbol word in a context with [SYMBOL], so the embedding
  cannot lean on which symbol it is and has to place the passage by what surrounds the word.
- center_document_means / center_by_document: subtract each book's mean embedding (over the
  sampled occurrences only) and L2-normalise again, removing the part of every vector that the
  passages of one book share. That shared part carries style, era, translator and subject; it
  also carries any symbolic content a book uses throughout, so this reduces, not eliminates,
  the book's influence and can remove some real signal with it.
"""
from __future__ import annotations

import re

import numpy as np

MASK = "[SYMBOL]"


def mask_symbol(context: str, matched_term: str) -> str:
    """Replace every whole-word, case-insensitive use of `matched_term` in the context.

    Only this exact term is masked (not other aliases of the symbol), and only as a whole word:
    "serpent" is masked, "serpentine" is not. A second use of the same word in the neighbouring
    sentences is masked too, since leaving it would tell the model which symbol this is.
    """
    if not matched_term.strip():
        return context
    pattern = re.compile(r"\b" + re.escape(matched_term) + r"\b", re.IGNORECASE)
    return pattern.sub(MASK, context)


def l2_normalize(vectors: np.ndarray) -> np.ndarray:
    norms = np.linalg.norm(vectors, axis=1, keepdims=True)
    return vectors / np.where(norms == 0, 1.0, norms)


def center_document_means(vectors: np.ndarray, document_ids: list[str]) -> np.ndarray:
    """Each vector minus the mean of the vectors from its own document (no normalisation)."""
    if len(vectors) != len(document_ids):
        raise ValueError("one document id per vector")
    out = vectors.astype(np.float64).copy()
    ids = np.asarray(document_ids)
    for doc in np.unique(ids):
        rows = ids == doc
        out[rows] -= out[rows].mean(axis=0)
    return out


def center_by_document(vectors: np.ndarray, document_ids: list[str]) -> np.ndarray:
    """Document-centred vectors, L2-normalised again, as float32."""
    return l2_normalize(center_document_means(vectors, document_ids)).astype(np.float32)
