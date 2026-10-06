"""Publish the Philosophy Atlas.

    python platform/publish/philosophy/export_philosophy.py

Writes under frontend/public/data/philosophy/:

    summary.json    the works (author, year, tradition, translator), the run (model, sample,
                    parameters) and the evaluation of both maps, the tensions
    atlas.json      per map variant, every sampled passage: id, work index, x, y, cluster
    passages.json   id -> a short excerpt of each sampled passage (read when one is opened)
    clusters.json   every cluster: composition, cross-work flag, representatives, distinctive
                    words, review status (labels only from human review)
    tensions.json   work × tension distributions, and the passages nearest each pole

No embedding is published.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parents[3]
DATABASE = Path(os.environ.get("PORTFOLIO_DB", ROOT / "warehouse/portfolio.duckdb"))
FEATURES = Path(os.environ.get("PORTFOLIO_FEATURES", ROOT / "warehouse/features")) / "philosophy"
OUT = ROOT / "frontend/public/data/philosophy"
EXCERPT = 420


def excerpt(text: str, limit: int = EXCERPT) -> str:
    return text if len(text) <= limit else text[:limit].rsplit(" ", 1)[0] + " …"


def rows(con, sql: str) -> list[dict]:
    records = json.loads(con.sql(sql).df().to_json(orient="records", force_ascii=False))
    for r in records:
        for k, v in r.items():
            if isinstance(v, float):
                r[k] = round(v, 4)
    return records


def dump(name: str, payload) -> Path:
    path = OUT / name
    path.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    return path


def main() -> int:
    con = duckdb.connect(str(DATABASE), read_only=True)
    OUT.mkdir(parents=True, exist_ok=True)
    works = rows(con, """select document_id, title, author, year, period, tradition, area, original_language,
                                translator, translator_note, genre, source_url, passages, words
                         from gold.dim_philosophy_document order by year""")
    index = {w["document_id"]: i for i, w in enumerate(works)}
    run = json.loads((FEATURES / "run.json").read_text(encoding="utf-8"))
    tensions = rows(con, """select tension_id, pole_a, pole_b, label_en, label_sv, anchor_a, anchor_b,
                                   description_en, description_sv from gold.dim_tension order by sort_order""")
    atlas = {}
    for variant in ("baseline", "author_centered"):
        pts = con.sql(f"""select passage_id, document_id, x, y, cluster_id from gold.mart_philosophy_atlas
                          where variant = '{variant}' order by passage_id""").fetchall()
        atlas[variant] = [[p, index[d], round(x, 3), round(y, 3), c] for p, d, x, y, c in pts]
    passages = {p: excerpt(t) for p, t in con.sql(
        "select distinct passage_id, text from gold.mart_philosophy_atlas").fetchall()}
    clusters = rows(con, """select variant, cluster_id, size, fingerprint, works, traditions, work_count,
                                   largest_work_share, work_entropy, is_cross_work, representatives,
                                   distinctive_terms, review_status, review_label
                            from gold.mart_philosophy_clusters order by variant, size desc""")
    for c in clusters:
        for key in ("works", "traditions", "representatives", "distinctive_terms"):
            c[key] = json.loads(c[key])
    distribution = rows(con, "select tension_id, document_id, passages, mean_position, q1, median, q3 from gold.mart_philosophy_tensions")
    poles = rows(con, "select tension_id, pole, rank, passage_id, document_id, position, text from gold.mart_philosophy_tension_poles order by tension_id, pole, rank")
    for p in poles:
        p["text"] = excerpt(p["text"], 360)
    summary = {
        "works": works, "tensions": tensions,
        "run": {k: run[k] for k in ("model", "passages_total", "passages_sampled", "per_document", "works",
                                    "umap_map", "hdbscan", "neighbours", "evaluation", "ran_at")},
        "reviewed_clusters": sum(c["review_status"] == "reviewed" for c in clusters),
    }
    written = [dump("summary.json", summary), dump("atlas.json", atlas), dump("passages.json", passages),
               dump("clusters.json", clusters),
               dump("tensions.json", {"distribution": distribution, "poles": poles})]
    sys.path.insert(0, str(ROOT / "platform/publish/symbolic"))
    import export_symbolic

    export_symbolic.register(written)
    print(f"Philosophy Atlas: {len(works)} works, {run['passages_sampled']} passages -> {OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
