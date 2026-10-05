"""The Symbolic Atlas's machine-learning stage, after dbt has built the silver occurrences.

    python platform/nlp/symbolic/pipeline.py

1. Read silver.int_symbol_occurrences from the warehouse.
2. Take a deterministic sample: at most PER_PAIR occurrences per book and symbol, chosen by
   occurrence id (a hash, so the choice is fixed and unrelated to position in the book). A
   long book or a common word would otherwise fill the map.
3. Embed each context (embeddings.py), lay the points out and cluster them (clustering.py),
   and measure the result (evaluation.py).
4. Write under warehouse/features/symbolic/: occurrence_embeddings.parquet (local only),
   atlas_projection.parquet (id, x, y, cluster, probability, noise), evaluation.json and
   run.json (model, parameters, counts, time).

Stops with an error when there are fewer than MIN_OCCURRENCES occurrences: clusters of a
handful of points would mean nothing.
"""
from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import clustering  # noqa: E402
import embeddings  # noqa: E402
import evaluation  # noqa: E402

ROOT = HERE.parents[2]
DATABASE = Path(os.environ.get("PORTFOLIO_DB", ROOT / "warehouse/portfolio.duckdb"))
FEATURES = Path(os.environ.get("PORTFOLIO_FEATURES", ROOT / "warehouse/features")) / "symbolic"
PER_PAIR = 30
MIN_OCCURRENCES = 500


def load(database: Path = DATABASE, per_pair: int = PER_PAIR) -> list[tuple[str, str, str, str]]:
    import duckdb

    con = duckdb.connect(str(database), read_only=True)
    try:
        return con.execute(
            "select occurrence_id, context, document_id, symbol_id from silver.int_symbol_occurrences "
            "qualify row_number() over (partition by document_id, symbol_id order by occurrence_id) <= ? "
            "order by occurrence_id", [per_pair]).fetchall()
    finally:
        con.close()


def check_size(n: int, minimum: int = MIN_OCCURRENCES) -> None:
    if n < minimum:
        raise SystemExit(f"Only {n} occurrences; at least {minimum} are needed for clusters to mean "
                         "anything. Ingest more of the corpus or widen the vocabulary.")


def write_projection(path: Path, ids, layout, labels, probabilities) -> None:
    import pyarrow as pa
    import pyarrow.parquet as pq

    pq.write_table(pa.table({
        "occurrence_id": pa.array(ids, pa.string()),
        "x": pa.array(layout[:, 0], pa.float32()),
        "y": pa.array(layout[:, 1], pa.float32()),
        "cluster_id": pa.array(labels, pa.int32()),
        "cluster_probability": pa.array(probabilities, pa.float32()),
        "is_noise": pa.array(labels == -1, pa.bool_()),
    }), path)


def main() -> int:
    rows = load()
    check_size(len(rows))
    ids = [r[0] for r in rows]
    started = datetime.now(timezone.utc)
    print(f"Embedding {len(ids)} contexts with {embeddings.MODEL} …", flush=True)
    vectors = embeddings.embed([r[1] for r in rows])
    FEATURES.mkdir(parents=True, exist_ok=True)
    embeddings.write(FEATURES / "occurrence_embeddings.parquet", ids, vectors)
    print("UMAP and HDBSCAN …", flush=True)
    layout = clustering.reduce(vectors, clustering.MAP)
    space = clustering.reduce(vectors, clustering.SPACE)
    labels, probabilities = clustering.cluster(space)
    metrics = evaluation.evaluate(vectors, layout, space, labels, probabilities)
    metrics["composition"] = evaluation.composition(labels, [r[2] for r in rows], [r[3] for r in rows])
    write_projection(FEATURES / "atlas_projection.parquet", ids, layout, labels, probabilities)
    (FEATURES / "evaluation.json").write_text(json.dumps(metrics, indent=2) + "\n", encoding="utf-8")
    run = {
        "run_at": started.isoformat(timespec="seconds"),
        "seconds": round((datetime.now(timezone.utc) - started).total_seconds(), 1),
        "embedding_model": embeddings.MODEL,
        "dimensions": int(vectors.shape[1]),
        "sample": {"per_document_and_symbol": PER_PAIR, "order": "occurrence_id"},
        "umap_map": clustering.MAP,
        "umap_cluster_space": clustering.SPACE,
        "hdbscan": clustering.HDBSCAN,
        "occurrences": len(ids),
        "clusters": metrics["clusters"],
        "noise_share": metrics["noise_share"],
    }
    (FEATURES / "run.json").write_text(json.dumps(run, indent=2) + "\n", encoding="utf-8")
    print(evaluation.summary(metrics))
    return 0


if __name__ == "__main__":
    sys.exit(main())
