"""Export the statute-book page's numbers to the site.

    python platform/publish/export_sfs.py

Writes frontend/public/data/sfs/overview.json from gold.fct_sfs_document and
gold.fct_sfs_passage:
    fetched     first and last fetch time of the texts
    kinds       documents, fetched texts, repealed, numbered paragraphs and passages per kind
    parse       documents per parse status
    missing     the documents whose text could not be fetched
    years       per year of issue: documents by kind; per year of repeal: repealed documents
    lengths     passages per length band (characters), and p50, p95 and max, per passage kind
    largest     the laws in force with the most numbered paragraphs
    tests       dbt test outcomes of the build the export read

Run after `dbt build --select tag:sfs --target-path target/sfs`.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))

import duckdb  # noqa: E402

from common import PUBLIC, ROOT, write_json  # noqa: E402

DATABASE = Path(os.environ.get("PORTFOLIO_DB", ROOT / "warehouse/portfolio.duckdb"))
RUN_RESULTS = ROOT / "platform/target/sfs/run_results.json"
OUT = PUBLIC / "sfs/overview.json"
# Upper bounds of the length bands, in characters; the last band is everything above 1,500.
BANDS = (100, 250, 500, 1000, 1500)
LARGEST = 15


def records(con, sql: str) -> list[dict]:
    cursor = con.execute(sql)
    names = [c[0] for c in cursor.description]
    return [dict(zip(names, row)) for row in cursor.fetchall()]


def dbt_tests() -> dict:
    if not RUN_RESULTS.is_file():
        raise SystemExit(f"No dbt run results at {RUN_RESULTS}; run the sfs build first")
    results = json.loads(RUN_RESULTS.read_text(encoding="utf-8"))["results"]
    failed = [r["unique_id"] for r in results if r["status"] in ("fail", "error")]
    if failed:
        raise SystemExit(f"Refusing to export: {failed}")
    tests = [r for r in results if r["unique_id"].startswith("test.")]
    if not tests:
        raise SystemExit("The last sfs dbt run had no tests; run dbt build, not run")
    return {s: sum(r["status"] == s for r in tests) for s in ("pass", "warn")}


def band_sql() -> str:
    cases = " ".join(f"when text_chars <= {b} then {b}" for b in BANDS)
    return f"case {cases} else null end"


def export(con) -> dict:
    doc = "gold.fct_sfs_document"
    first, last = con.execute(
        f"select min(fetched_at), max(fetched_at) from {doc}").fetchone()
    years = records(con, f"""
        with issued as (
            select issued_year as year,
                   count(*) filter (where kind = 'lag') as lag,
                   count(*) filter (where kind = 'förordning') as "förordning",
                   count(*) filter (where kind = 'other') as other
            from {doc} group by 1
        ),
        repealed as (
            select repealed_year as year, count(*) as repealed
            from {doc} where is_repealed group by 1
        )
        select year, coalesce(lag, 0) as lag, coalesce("förordning", 0) as "förordning",
               coalesce(other, 0) as other, coalesce(repealed, 0) as repealed
        from issued full join repealed using (year)
        order by year""")
    return {
        "fetched": {"first": first.isoformat(), "last": last.isoformat()},
        "kinds": records(con, f"""
            select kind, count(*) as documents, count(*) filter (where has_text) as fetched,
                   count(*) filter (where is_repealed) as repealed,
                   sum(sections)::int as sections,
                   sum(paragraph_passages)::int as paragraph_passages,
                   sum(whole_text_passages)::int as whole_text_passages
            from {doc} group by kind order by documents desc"""),
        "parse": records(con, f"""
            select parse_status as status, count(*) as documents,
                   count(*) filter (where whole_text_passages > 0) as with_whole_text
            from {doc} group by 1 order by 2 desc"""),
        "missing": records(con, f"""
            select dok_id, sfs, title, issued::varchar as issued
            from {doc} where not has_text order by issued"""),
        "years": years,
        "lengths": records(con, f"""
            select kind, {band_sql()} as up_to, count(*) as passages
            from gold.fct_sfs_passage group by all order by kind, up_to nulls last"""),
        "length_stats": records(con, """
            select kind, quantile_cont(text_chars, 0.5)::int as p50,
                   quantile_cont(text_chars, 0.95)::int as p95, max(text_chars) as max
            from gold.fct_sfs_passage group by kind order by kind"""),
        "largest": records(con, f"""
            select dok_id, sfs, title, sections, paragraph_passages
            from {doc} where kind = 'lag' and not is_repealed
            order by sections desc, sfs limit {LARGEST}"""),
        "tests": dbt_tests(),
    }


def main() -> None:
    con = duckdb.connect(str(DATABASE), read_only=True)
    try:
        overview = export(con)
    finally:
        con.close()
    assert sum(k["documents"] for k in overview["kinds"]) == sum(
        p["documents"] for p in overview["parse"]), "kinds and parse statuses disagree"
    write_json(OUT, overview)
    print(f"Wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
