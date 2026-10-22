"""Philosophy track 1 (docs/philosophy-moral-preregistration.md): shared paths and the bge-m3 call.

Raw source files live under warehouse/raw/philosophy_moral (with rawstore's _manifest.jsonl), the
derived tables under warehouse/features/philosophy/moral; warehouse_store.py carries both to R2.
Texts stay local: the features folder holds ids, vectors, labels and figures, never comment, scenario
or speech text, except the Riksdag sample in features/philosophy/moral/run, which is not published.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

import numpy as np
import pandas as pd

REPO = Path(__file__).resolve().parents[2]
RAW = Path(os.environ.get("PORTFOLIO_RAW", REPO / "warehouse/raw")) / "philosophy_moral"
FEATURES = Path(os.environ.get("PORTFOLIO_FEATURES", REPO / "warehouse/features")) / "philosophy/moral"
FOUNDATIONS = ["care", "equality", "proportionality", "loyalty", "authority", "purity"]


def embed(ids: list[str], texts: list[str], name: str, agent: str) -> np.ndarray | None:
    """bge-m3 vectors in input order through platform/nlp/workers_ai.py, or None while any is missing."""
    sys.path.insert(0, str(REPO / "platform/nlp"))
    import workers_ai

    run = FEATURES / "vectors" / name
    # Stored vectors for exactly these ids (pulled from R2 in cluster-jobs.yml) need no call.
    if ((run / "vectors.npy").is_file() and (run / "ids.json").is_file()
            and json.loads((run / "ids.json").read_text(encoding="utf-8")) == [str(i) for i in ids]):
        return np.load(run / "vectors.npy")
    run.mkdir(parents=True, exist_ok=True)
    corpus = run / "corpus.parquet"
    pd.DataFrame({"id": ids, "text": texts}).to_parquet(corpus, index=False)
    args = argparse.Namespace(input=corpus, out=run, id_column="id", text_column="text", limit=None,
                              max_tokens_per_run=4_000_000, agent=agent, wait_for_reset=False, dry_run=False)
    try:
        if workers_ai.embed(args) != 0:
            return None
        return np.load(run / "vectors.npy")
    finally:
        # The texts are only needed for the call; the vectors and ids are what is kept.
        corpus.unlink(missing_ok=True)
