"""Publish the SWEDEN E futures topic pilot from gold.mart_sweden_future_topics and
gold.mart_sweden_future_topic_clusters, with the run's method block
(warehouse/features/sweden/futures_topics/method.json, written by ml/futures_topics/analyze.py).

    python platform/publish/sweden/export_futures_topics.py

Writes frontend/public/data/sweden/futures/topics.json: per cluster its unreviewed label, top
terms, stability and the exploratory tests; per year, corpus and cluster the share of sampled
sentences with its bootstrap interval. Only stable clusters are published. When the run fails the
stability or the structure null, clusters and rows are empty and method.result says that no stable
topic structure was found, as the pre-registration requires. No sentence text is published.
Labels stay "unreviewed cluster N" until the owner has reviewed the clusters.
"""
from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parents[3]
DATABASE = Path(os.environ.get("PORTFOLIO_DB", ROOT / "warehouse/portfolio.duckdb"))
FEATURES = Path(os.environ.get("PORTFOLIO_FEATURES", ROOT / "warehouse/features"))
OUT = ROOT / "frontend/public/data/sweden/futures/topics.json"


def r(value, digits=4):
    return None if value is None or value != value else round(float(value), digits)


def clusters(con) -> list[dict]:
    rows = con.execute("""select cluster, corpus, label, top_terms, stable, security_terms, corpus_specific,
            sentences, corpus_sentences, share_mean, trend_slope, trend_p_holm, r_lag0, p_lag0_holm, best_lag,
            r_best_lag, p_best_lag_holm from gold.mart_sweden_future_topic_clusters
            where stable order by cluster, corpus""").fetchall()
    out: dict[int, dict] = {}
    for (c, corpus, label, terms, stable, security, specific, n, n_corpus, mean, slope, p, r0, p0, lag, rl,
         pl) in rows:
        item = out.setdefault(c, {"cluster": c, "label": label, "top_terms": terms.split(", "), "stable": stable,
                                  "security_terms": security, "corpus_specific": specific, "sentences": n,
                                  "riksdag_vs_diva": None if r0 is None or r0 != r0 else {
                                      "r_lag0": r(r0), "p_lag0_holm": r(p0), "best_lag": lag,
                                      "r_best_lag": r(rl), "p_best_lag_holm": r(pl)}})
        item[corpus] = {"sentences": n_corpus, "share_mean": r(mean), "trend_per_decade": r(slope * 10, 5),
                        "trend_p_holm": r(p)}
    return list(out.values())


def main() -> int:
    con = duckdb.connect(str(DATABASE), read_only=True)
    if not con.execute("select count(*) from gold.mart_sweden_future_topics").fetchone()[0]:
        raise SystemExit("gold.mart_sweden_future_topics is empty; run the pilot and dbt first")
    method = json.loads((FEATURES / "sweden/futures_topics/method.json").read_text(encoding="utf-8"))
    found = method["stability"]["passes"] and method["null_shuffled_dimensions"]["passes"]
    cells = con.execute("""select year, corpus, cluster, sentences, year_sentences, share, share_low, share_high
        from gold.mart_sweden_future_topics where stable order by corpus, cluster, year""").fetchall() if found else []
    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "method": {**method, "review": "unreviewed: no cluster is named until the owner has reviewed it",
                   "result": "stable topic structure" if found else "no stable topic structure"},
        "clusters": clusters(con) if found else [],
        "columns": ["year", "corpus", "cluster", "sentences", "year_sentences", "share", "share_low", "share_high"],
        "rows": [[y, c, k, n, int(t), r(s), r(lo), r(hi)] for y, c, k, n, t, s, lo, hi in cells],
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":"), default=float) + "\n",
                   encoding="utf-8")
    sys.path.insert(0, str(ROOT / "platform/publish/symbolic"))
    import export_symbolic

    export_symbolic.register([OUT])
    print(f"SWEDEN futures topics: {len(payload['clusters'])} clusters, {len(cells)} cells -> {OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
