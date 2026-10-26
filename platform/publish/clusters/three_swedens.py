"""Write frontend/public/data/clusters/three-swedens.json (H4, idea I-2).

    python platform/publish/clusters/three_swedens.py

Runs after `python -m ml.three_swedens` and `dbt build --select tag:clusters`. Takes the method,
the Mantel diagnostics, the grouping decision and generated_at from the run's metrics.json, and
the 20 municipalities with the least agreement, with their neighbours by name from
gold.mart_municipality_three_spaces, so a reader can check each one without the map's colours. A NaN stops the export.
"""
from __future__ import annotations

import json

import duckdb

import stats

NAME = "three-swedens"
SPACES = ["social", "jobs", "votes"]


def payload(con) -> dict:
    metrics = json.loads((stats.FEATURES / NAME / "run/metrics.json").read_text(encoding="utf-8"))
    names = dict(con.sql("select municipality_code, municipality_name from gold.dim_municipality "
                         "where valid_to is null").fetchall())
    rows = con.sql(f"""select municipality_code, municipality_name, misfit_rank, agreement,
                              jaccard_social_jobs, jaccard_social_votes, jaccard_jobs_votes,
                              {', '.join(f'neighbours_{s}' for s in SPACES)}
                       from gold.mart_municipality_three_spaces where is_misfit order by misfit_rank""").fetchall()
    cut = metrics["diagnostics"]["misfit_cutoff"]
    misfits = [{"code": r[0], "name": r[1], "rank": r[2], "agreement": r[3],
                "jaccard": {"social_jobs": r[4], "social_votes": r[5], "jobs_votes": r[6]},
                "neighbours": {s: [names[c] for c in r[7 + i]] for i, s in enumerate(SPACES)}} for r in rows]
    return {"schema_version": 1, "name": NAME, "title": "Three Swedens: social, job-ad and vote neighbours",
            **{k: metrics[k] for k in ("generated_at", "preregistration", "method", "coverage", "diagnostics",
                                       "grouping")},
            "misfits": misfits,
            "notes": ["Descriptive only: municipalities where the neighbours differ, not people who differ.",
                      "Agreement is the mean Jaccard overlap of the 10 nearest neighbours across the three "
                      "pairs of spaces; the list holds the 20 municipalities with the least agreement.",
                      f"{cut['at_or_below']} municipalities have an agreement of {cut['agreement']} or less, the "
                      "value of the 20th; ties are broken by municipality code, as pre-registered.",
                      *[t["note"] for t in metrics["diagnostics"]["tests"]
                        if t["pair"] == ["social", "votes"] and t.get("note")][:1],
                      metrics["grouping"]["note"]]}


def main() -> None:
    with duckdb.connect(str(stats.DATABASE), read_only=True) as con:
        body = json.dumps(payload(con), ensure_ascii=False, allow_nan=False, separators=(",", ":")) + "\n"
    out = stats.PUBLIC / "clusters" / f"{NAME}.json"
    out.write_text(body, encoding="utf-8", newline="\n")
    print(f"clusters/{NAME}.json {len(body.encode('utf-8'))} bytes")


if __name__ == "__main__":
    main()
