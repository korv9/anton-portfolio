"""Publish the Symbolic Atlas: a small summary for first paint, the atlas points and the symbol
profiles as Parquet.

    python platform/publish/symbolic/export_symbolic.py

Writes under frontend/public/data/symbolic/:

    summary.json            counts, symbols, traditions, books, the run's model and parameters,
                            and the evaluation (served with the site)
    atlas.parquet           one row per point: id, symbol, book, tradition, word, a short
                            context excerpt, x, y, cluster, probability, noise
    symbol-profiles.parquet per symbol and cluster: count, share, mean probability
    preview.json            every tenth point (by id): x, y and cluster only, for the small
                            picture on the start page
    experiment-comparison.json  one row per deconfounding experiment (nlp/symbolic/experiments.py)
    cross-book-clusters.json    the clusters that draw on several books, with their
                            representative occurrence ids; both only when the experiments have run

The three files are registered in the delivery catalogue (catalog.json, delivery.json) with the
same rules as publish/build_catalog.py, touching no other entry: Parquet goes to object storage,
so the "Publish to R2" workflow uploads it, and the site reads it from R2 and falls back to its
own copy. No embedding and no book text beyond each point's short excerpt is delivered.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
DATABASE = Path(os.environ.get("PORTFOLIO_DB", ROOT / "warehouse/portfolio.duckdb"))
FEATURES = Path(os.environ.get("PORTFOLIO_FEATURES", ROOT / "warehouse/features")) / "symbolic"
OUT = ROOT / "frontend/public/data/symbolic"
EXCERPT = 360
ATLAS_COLUMNS = ["occurrence_id", "symbol_id", "document_id", "title", "tradition", "matched_term",
                 "context", "x", "y", "cluster_id", "cluster_probability", "is_noise"]


def excerpt(context: str, term: str, limit: int = EXCERPT) -> str:
    """At most `limit` characters of the context, centred on the matched word."""
    if len(context) <= limit:
        return context
    at = context.lower().find(term.lower())
    centre = at + len(term) // 2 if at >= 0 else len(context) // 2
    lo = max(0, min(centre - limit // 2, len(context) - limit))
    piece = context[lo:lo + limit]
    if lo > 0:
        piece = "… " + piece[piece.find(" ") + 1:]
    if lo + limit < len(context):
        piece = piece[: piece.rfind(" ")] + " …"
    return piece


def register(paths: list[Path]) -> None:
    """Add or update these files in catalog.json and delivery.json, leaving every other entry."""
    import hashlib

    sys.path.insert(0, str(ROOT / "platform/publish"))
    import build_catalog as bc

    catalog = json.loads(bc.CATALOG.read_text(encoding="utf-8"))
    delivery = json.loads(bc.DELIVERY.read_text(encoding="utf-8"))
    entries = {e["path"]: e for e in catalog["files"]}
    for path in paths:
        relative = path.relative_to(bc.PUBLIC).as_posix()
        content = path.read_bytes().replace(b"\r\n", b"\n")
        fmt = bc.classify(relative)
        entries[relative] = {"path": relative, "product": bc.product_of(relative), "format": fmt,
                             "bytes": len(content), "rows": bc.row_count(path, fmt),
                             "schema_version": bc.SCHEMA_VERSION, "partition": bc.partition_of(relative),
                             "sha256": hashlib.sha256(content).hexdigest()}
        if fmt == "parquet":
            delivery["parquet_datasets"][relative.split("/")[1]] = [relative]
    files = sorted(entries.values(), key=lambda e: e["path"])
    run_id = hashlib.sha256("".join(f"{e['path']}:{e['sha256']}" for e in files).encode()).hexdigest()[:16]
    for entry in files:
        entry["run_id"] = run_id
    catalog.update(run_id=run_id, files=files)
    delivery["run_id"] = run_id
    delivery["parquet_datasets"] = dict(sorted(delivery["parquet_datasets"].items()))
    bc.CATALOG.write_text(json.dumps(catalog, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    bc.DELIVERY.write_text(json.dumps(delivery, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


def experiment_files() -> list[Path]:
    """The small experiment summaries, when experiments.py has run. No embedding, no text."""
    import pyarrow.parquet as pq

    folder = FEATURES / "experiments"
    if not (folder / "comparison.json").is_file():
        return []
    comparison = json.loads((folder / "comparison.json").read_text(encoding="utf-8"))
    (OUT / "experiment-comparison.json").write_text(
        json.dumps(comparison, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    cross = []
    for row in comparison["experiments"]:
        name = row["experiment"]
        composition = pq.read_table(folder / name / "cluster_composition.parquet").to_pylist()
        reps = pq.read_table(folder / name / "cluster_representatives.parquet").to_pylist()
        for c in composition:
            if not c["cross_book_cluster"]:
                continue
            cross.append({k: c[k] for k in ("experiment", "cluster_id", "book_count", "tradition_count",
                                             "occurrence_count", "largest_book_share",
                                             "largest_tradition_share", "largest_symbol")}
                         | {"representative_occurrence_ids": [r["occurrence_id"] for r in reps
                                                              if r["cluster_id"] == c["cluster_id"]]})
    (OUT / "cross-book-clusters.json").write_text(
        json.dumps(cross, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    return [OUT / "experiment-comparison.json", OUT / "cross-book-clusters.json"]


def main() -> int:
    import duckdb
    import pyarrow as pa
    import pyarrow.parquet as pq

    con = duckdb.connect(str(DATABASE), read_only=True)
    os.chdir(ROOT / "platform")  # the bronze views read raw files by a path relative to platform/
    atlas = con.execute(f"select {', '.join(ATLAS_COLUMNS)} from gold.mart_symbol_atlas "
                        "order by occurrence_id").to_arrow_table()
    profiles = con.execute("select * from gold.mart_symbol_profiles "
                           "order by symbol_id, cluster_id").to_arrow_table()
    books = con.execute(
        "select d.document_id, d.title, d.author, d.tradition, d.word_count, s.gutenberg_id, s.source_url, "
        "(select count(*) from gold.mart_symbol_atlas a where a.document_id = d.document_id) as points "
        "from silver.int_symbolic_documents d join bronze.stg_symbolic_documents s using (document_id) "
        "order by d.tradition, d.document_id").fetchall()
    symbols = con.execute(
        "select s.symbol_id, s.label, count(a.occurrence_id) as points, "
        "(select count(*) from silver.int_symbol_occurrences o where o.symbol_id = s.symbol_id) as occurrences "
        "from seeds.symbols s left join gold.mart_symbol_atlas a using (symbol_id) "
        "group by 1, 2 order by 1").fetchall()
    total_occurrences = con.execute("select count(*) from silver.int_symbol_occurrences").fetchone()[0]
    con.close()

    contexts = atlas.column("context").to_pylist()
    terms = atlas.column("matched_term").to_pylist()
    atlas = atlas.set_column(atlas.schema.get_field_index("context"), "context",
                             pa.array([excerpt(c, t) for c, t in zip(contexts, terms)], pa.string()))
    atlas = atlas.cast(pa.schema([
        (f.name, pa.float32() if f.name in ("x", "y", "cluster_probability") else
         pa.int32() if f.name == "cluster_id" else f.type) for f in atlas.schema]))
    OUT.mkdir(parents=True, exist_ok=True)
    pq.write_table(atlas, OUT / "atlas.parquet", compression="snappy")
    pq.write_table(profiles, OUT / "symbol-profiles.parquet", compression="snappy")

    run = json.loads((FEATURES / "run.json").read_text(encoding="utf-8"))
    metrics = json.loads((FEATURES / "evaluation.json").read_text(encoding="utf-8"))
    labels = atlas.column("cluster_id").to_pylist()
    summary = {
        "document_count": len(books),
        "occurrence_count": total_occurrences,
        "point_count": atlas.num_rows,
        "symbol_count": len(symbols),
        "cluster_count": metrics["clusters"],
        "noise_share": metrics["noise_share"],
        "symbols": [{"id": s[0], "label": s[1], "points": s[2], "occurrences": s[3]} for s in symbols],
        "traditions": sorted({b[3] for b in books}),
        "documents": [{"id": b[0], "title": b[1], "author": b[2], "tradition": b[3], "words": b[4],
                       "gutenberg_id": b[5], "source_url": b[6], "points": b[7]} for b in books],
        "clusters": sorted(set(labels)),
        "run": {k: run[k] for k in ("run_at", "embedding_model", "dimensions", "sample", "umap_map",
                                    "umap_cluster_space", "hdbscan")},
        "evaluation": {k: metrics[k] for k in ("trustworthiness", "silhouette", "membership_probability",
                                               "composition", "cluster_sizes")},
    }
    (OUT / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, separators=(",", ":")) + "\n",
                                      encoding="utf-8")
    ids = atlas.column("occurrence_id").to_pylist()
    xs, ys = atlas.column("x").to_pylist(), atlas.column("y").to_pylist()
    preview = [[round(xs[i], 3), round(ys[i], 3), labels[i]] for i in range(0, len(ids), 10)]
    (OUT / "preview.json").write_text(json.dumps({"columns": ["x", "y", "cluster_id"], "points": preview},
                                                 separators=(",", ":")) + "\n", encoding="utf-8")
    register([OUT / "atlas.parquet", OUT / "summary.json", OUT / "symbol-profiles.parquet",
              OUT / "preview.json", *experiment_files()])
    size = (OUT / "atlas.parquet").stat().st_size
    print(f"{atlas.num_rows} points, {metrics['clusters']} clusters, atlas.parquet {size / 1e3:.0f} kB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
