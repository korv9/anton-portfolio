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

and, when the book-centred experiment and the cluster review (nlp/symbolic/rank_clusters.py)
have run:

    book-centered-atlas.parquet  the book-centred map of the same points: id, x, y, cluster,
                            probability, noise (the rest of each point is in atlas.parquet)
    book-centered-clusters.json  every book-centred cluster: counts, shares, entropies, the audit
                            flags, review class and status, top symbols and traditions, and
                            representative occurrence ids (nearest the centroid, and diverse)
    cross-book-clusters.json    the cross-book subset of those, each marked with its review status
    reviewed-clusters.json  only clusters a person has reviewed (nlp/symbolic/reviews.py):
                            label, description, interpretation, confidence. Empty until then.
    research-history.json   the method history (v1 baseline, v2 book-centred, v3 paratext
                            cleaned, v4 expanded corpus) with the numbers of each step, the
                            validity checks, the cleaning audit and the review counts

The files are registered in the delivery catalogue (catalog.json, delivery.json) with the
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
# Parquet is served from object storage, apart from the site's own JSON. Each atlas version has
# its own folder there, so the published site keeps reading the files it was built with until
# the new version is deployed with its own JSON.
ATLAS_VERSION = "v4"
PARQUET = OUT / ATLAS_VERSION
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
    current = {path.relative_to(bc.PUBLIC).as_posix() for path in paths}
    # Parquet of an earlier atlas version leaves the catalogue; its copy in storage stays for
    # the site that still reads it.
    entries = {e["path"]: e for e in catalog["files"]
               if not (e["path"].startswith("symbolic/") and e["path"].endswith(".parquet")
                       and e["path"] not in current)}
    for name, parts in list(delivery["parquet_datasets"].items()):
        if any(p.startswith("symbolic/") and p not in current for p in parts):
            del delivery["parquet_datasets"][name]
    for path in paths:
        relative = path.relative_to(bc.PUBLIC).as_posix()
        content = path.read_bytes().replace(b"\r\n", b"\n")
        fmt = bc.classify(relative)
        entries[relative] = {"path": relative, "product": bc.product_of(relative), "format": fmt,
                             "bytes": len(content), "rows": bc.row_count(path, fmt),
                             "schema_version": bc.SCHEMA_VERSION, "partition": bc.partition_of(relative),
                             "sha256": hashlib.sha256(content).hexdigest()}
        if fmt == "parquet":
            delivery["parquet_datasets"][relative.split("/")[-1]] = [relative]
    files = sorted(entries.values(), key=lambda e: e["path"])
    run_id = hashlib.sha256("".join(f"{e['path']}:{e['sha256']}" for e in files).encode()).hexdigest()[:16]
    for entry in files:
        entry["run_id"] = run_id
    catalog.update(run_id=run_id, files=files)
    delivery["run_id"] = run_id
    delivery["parquet_datasets"] = dict(sorted(delivery["parquet_datasets"].items()))
    bc.CATALOG.write_text(json.dumps(catalog, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    bc.DELIVERY.write_text(json.dumps(delivery, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


def _dump(name: str, payload) -> Path:
    path = OUT / name
    path.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    return path


def experiment_files() -> list[Path]:
    """The experiment comparison, when experiments.py has run. No embedding, no text."""
    folder = FEATURES / "experiments"
    if not (folder / "comparison.json").is_file():
        return []
    comparison = json.loads((folder / "comparison.json").read_text(encoding="utf-8"))
    return [_dump("experiment-comparison.json", comparison)]


CLUSTER_FIELDS = ["cluster_id", "cluster_fingerprint", "occurrence_count", "book_count", "tradition_count",
                  "symbol_count", "largest_book", "largest_book_share", "largest_tradition",
                  "largest_tradition_share", "largest_symbol", "largest_symbol_share", "book_entropy",
                  "tradition_entropy", "symbol_entropy", "avg_membership_probability", "cross_book_cluster",
                  "suspected_paratext", "book_dominated", "too_small", "low_membership", "review_class",
                  "review_status", "review_priority_score"]


def review_files() -> list[Path]:
    """The book-centred map and its reviewed / cross-book cluster metadata. The ranking is rerun
    here so the published review status always matches reviewed_clusters.json."""
    import pyarrow as pa
    import pyarrow.parquet as pq

    folder = FEATURES / "experiments" / "book_centered"
    if not (folder / "atlas_projection.parquet").is_file():
        return []
    sys.path.insert(0, str(ROOT / "platform/nlp/symbolic"))
    import rank_clusters
    import reviews

    rank_clusters.main("book_centered")
    review = FEATURES / "review"
    projection = pq.read_table(folder / "atlas_projection.parquet")
    projection = projection.cast(pa.schema([
        (f.name, pa.float32() if f.name in ("x", "y", "cluster_probability") else
         pa.int32() if f.name == "cluster_id" else f.type) for f in projection.schema]))
    pq.write_table(projection, PARQUET / "book-centered-atlas.parquet", compression="snappy")

    candidates = pq.read_table(review / "cluster_candidates.parquet").to_pylist()
    passages = pq.read_table(review / "representative_passages.parquet").to_pylist()
    symbols = pq.read_table(review / "cluster_symbols.parquet").to_pylist()
    traditions = pq.read_table(review / "cluster_traditions.parquet").to_pylist()

    def top(rows, key, c, n=5):
        return [{key: r[key], "share": r["share"]} for r in rows if r["cluster_id"] == c][:n]

    def reps(c, kind, n=8):
        return [r["occurrence_id"] for r in passages
                if r["cluster_id"] == c and r["representative_set"] == kind][:n]

    clusters = sorted(({**{k: r[k] for k in CLUSTER_FIELDS},
                        "top_symbols": top(symbols, "symbol_id", r["cluster_id"]),
                        "top_traditions": top(traditions, "tradition", r["cluster_id"]),
                        "representatives": {"centroid": reps(r["cluster_id"], "centroid"),
                                            "diverse": reps(r["cluster_id"], "diverse")}}
                       for r in candidates), key=lambda r: r["cluster_id"])
    by_id = {c["cluster_id"]: c for c in clusters}
    note = ("Clusters are numbered, not named. review_status says whether a person has read the "
            "cluster; review_class is the automatic audit (candidate, warning, reject), never a "
            "judgement of meaning. Only reviewed-clusters.json carries labels.")
    public = reviews.public(reviews.load(), {c["cluster_fingerprint"]: c["cluster_id"] for c in clusters})
    for entry in public:
        c = by_id[entry["cluster_id"]]
        entry.update({k: c[k] for k in ("book_count", "tradition_count", "symbol_count")},
                     representative_occurrence_ids=c["representatives"]["diverse"])
    return [
        PARQUET / "book-centered-atlas.parquet",
        _dump("book-centered-clusters.json", {"experiment": "book_centered", "note": note, "clusters": clusters}),
        _dump("cross-book-clusters.json", {"experiment": "book_centered", "note": note,
                                           "clusters": [c for c in clusters if c["cross_book_cluster"]]}),
        _dump("reviewed-clusters.json", {"experiment": "book_centered", "clusters": public}),
        _dump("research-history.json", research_history(json.loads((review / "review_summary.json").read_text()))),
    ]


def corpus_size() -> int:
    corpus = ROOT / "platform/ingest/symbolic/corpus.json"
    return len(json.loads(corpus.read_text(encoding="utf-8"))["documents"])


def validity() -> dict | None:
    """What the clusters follow (nlp/symbolic/validity.py): association with each property and
    the similarity of book pairs that share one."""
    path = FEATURES / "validity.json"
    return json.loads(path.read_text(encoding="utf-8")) if path.is_file() else None


def research_history(review_summary: dict) -> dict:
    """The steps of the investigation with the numbers each produced: the baseline and the
    book-centred run before the paratext cleaning (experiments/history/v2-before-cleaning), the
    cleaned ten-book pilot (experiments/history/v3-pilot), the expanded corpus (the current
    experiments), the validity checks, the cleaning audit and the review counts."""
    folder = FEATURES / "experiments"

    def rows(path: Path) -> dict:
        if not path.is_file():
            return {}
        return {r["experiment"]: r for r in json.loads(path.read_text(encoding="utf-8"))["experiments"]}

    keys = ["occurrences", "clusters", "noise_share", "mean_largest_book_share", "mean_book_entropy",
            "cross_book_cluster_count", "cross_book_occurrence_share", "silhouette", "trustworthiness",
            "median_membership"]
    before = rows(folder / "history/v2-before-cleaning/comparison.json")
    pilot = rows(folder / "history/v3-pilot/comparison.json")
    current = rows(folder / "comparison.json")
    pick = lambda r: {k: r.get(k) for k in keys} if r else None  # noqa: E731
    post = folder / "post_cleaning_comparison.json"
    paratext = {}
    if post.is_file():
        for name, entry in json.loads(post.read_text(encoding="utf-8"))["experiments"].items():
            if "paratext" in entry:
                paratext[name] = {side: {k: v for k, v in entry["paratext"][side].items() if k != "suspected"}
                                  for side in ("before", "after")}
    cleaning_file = FEATURES / "cleaning_comparison.json"
    cleaning = None
    if cleaning_file.is_file():
        c = json.loads(cleaning_file.read_text(encoding="utf-8"))
        cleaning = {k: c.get(k) for k in ("old_occurrence_count", "new_occurrence_count", "removed_occurrences")}
        cleaning["documents_affected"] = len(c.get("documents_affected") or [])
        cleaning["documents"] = [{k: d[k] for k in ("document_id", "removed_share", "sections_removed",
                                                    "footnote_blocks_removed")} for d in c.get("cleaning", [])]
    return {
        "steps": [
            {"id": "v1", "name": "Baseline embeddings", "metrics": pick(before.get("baseline"))},
            {"id": "v2", "name": "Book-centred embeddings", "metrics": pick(before.get("book_centered"))},
            {"id": "v3", "name": "Paratext cleaned", "metrics": pick(pilot.get("book_centered")),
             "baseline_metrics": pick(pilot.get("baseline")), "documents": 10},
            {"id": "v4", "name": "Expanded corpus", "metrics": pick(current.get("book_centered")),
             "baseline_metrics": pick(current.get("baseline")), "documents": corpus_size()},
        ],
        "validity": validity(),
        "cleaning": cleaning,
        "paratext_clusters": paratext,
        "review": {k: review_summary.get(k) for k in (
            "cluster_count", "candidate_cluster_count", "warning_cluster_count", "rejected_by_flags_count",
            "reviewed_cluster_count", "rejected_cluster_count", "suspected_paratext_count",
            "cross_book_cluster_count", "weights", "thresholds")},
    }


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
        "(select count(*) from gold.mart_symbol_atlas a where a.document_id = d.document_id) as points, "
        "d.translator, d.culture, d.region, d.genre, d.source_type, d.period, d.pilot "
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
    PARQUET.mkdir(parents=True, exist_ok=True)
    pq.write_table(atlas, PARQUET / "atlas.parquet", compression="snappy")
    pq.write_table(profiles, PARQUET / "symbol-profiles.parquet", compression="snappy")

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
                       "gutenberg_id": b[5], "source_url": b[6], "points": b[7], "translator": b[8],
                       "culture": b[9], "region": b[10], "genre": b[11], "source_type": b[12],
                       "period": b[13], "pilot": bool(b[14])} for b in books],
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
    register([PARQUET / "atlas.parquet", OUT / "summary.json", PARQUET / "symbol-profiles.parquet",
              OUT / "preview.json", *experiment_files(), *review_files()])
    size = (PARQUET / "atlas.parquet").stat().st_size
    print(f"{atlas.num_rows} points, {metrics['clusters']} clusters, atlas.parquet {size / 1e3:.0f} kB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
