"""Export the welfare gold layer from the warehouse to the site's delivery paths.

JSON, served by the site, for first paint:
    welfare/indicators.json     dim_indicator with each indicator's coverage
    welfare/regions.json        dim_region
    welfare/county-year.json    mart_county_year_overview
    welfare/headlines.json      latest national value per indicator and the one before it
    welfare/run.json            when each source was fetched, row counts and dbt test results

Parquet, served from object storage, for filtering in the browser:
    parquet/welfare_indicator/source=<source>/part-0.parquet
        fct_indicator joined to its dimensions, one file per source

Run after `dbt build --select tag:welfare`; it reads the gold schema and refuses to export if the
last dbt run had a failing test.
"""
from __future__ import annotations

import json
import os
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))

import duckdb  # noqa: E402

from common import PUBLIC, ROOT, write_json  # noqa: E402

DATABASE = Path(os.environ.get("PORTFOLIO_DB", ROOT / "warehouse/portfolio.duckdb"))
RAW = Path(os.environ.get("PORTFOLIO_RAW", ROOT / "warehouse/raw"))
RUN_RESULTS = ROOT / "platform/target/run_results.json"
OUT = PUBLIC / "welfare"
PARQUET = PUBLIC / "parquet/welfare_indicator"
SOURCES = ("scb", "fk", "fohm", "ess", "kolada")


def records(connection, sql: str) -> list[dict]:
    cursor = connection.execute(sql)
    columns = [column[0] for column in cursor.description]
    return [dict(zip(columns, row)) for row in cursor.fetchall()]


def jsonable(value):
    if isinstance(value, float):
        return round(value, 4)
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return value


def clean(rows: list[dict]) -> list[dict]:
    return [{key: jsonable(value) for key, value in row.items()} for row in rows]


def dbt_summary() -> dict:
    """Test and model outcomes of the last dbt invocation, from its run_results.json."""
    if not RUN_RESULTS.exists():
        raise FileNotFoundError(f"{RUN_RESULTS} is missing; run dbt build first")
    results = json.loads(RUN_RESULTS.read_text(encoding="utf-8"))
    counts: dict[str, int] = {}
    tests = {"pass": 0, "fail": 0, "error": 0, "warn": 0, "skipped": 0}
    for result in results["results"]:
        kind = result["unique_id"].split(".")[0]
        counts[kind] = counts.get(kind, 0) + 1
        if kind == "test":
            tests[result["status"]] = tests.get(result["status"], 0) + 1
    # A compile or run leaves a run_results.json too, with no tests in it; only a build or
    # test invocation with passing tests may vouch for the export.
    command = results.get("args", {}).get("which")
    if command not in ("build", "test") or not tests["pass"]:
        raise SystemExit(f"Refusing to export: last dbt invocation was '{command}' with "
                         f"{tests['pass']} passing tests; run dbt build first")
    return {
        "invocation_id": results["metadata"]["invocation_id"],
        "command": command,
        "generated_at": results["metadata"]["generated_at"],
        "dbt_version": results["metadata"]["dbt_version"],
        "elapsed_seconds": round(results["elapsed_time"], 1),
        "nodes": counts,
        "tests": tests,
    }


def fetch_log() -> list[dict]:
    """Per source: latest fetch time, files, bytes, and when content last changed."""
    summary = []
    for source in SOURCES:
        manifest = RAW / source / "_manifest.jsonl"
        if not manifest.exists():
            summary.append({"source_key": source, "fetched_at": None})
            continue
        lines = [json.loads(line) for line in manifest.read_text(encoding="utf-8").splitlines()]
        latest = {}
        for line in lines:
            latest[line["path"]] = line
        changed = [line["fetched_at"] for line in lines if line["changed"]]
        summary.append({
            "source_key": source,
            "fetched_at": max(line["fetched_at"] for line in latest.values()),
            "content_changed_at": max(changed) if changed else None,
            "files": len(latest),
            "bytes": sum(line["bytes"] for line in latest.values()),
        })
    return summary


def main() -> None:
    dbt = dbt_summary()
    if dbt["tests"].get("fail") or dbt["tests"].get("error"):
        raise SystemExit(f"Refusing to export: dbt tests failed {dbt['tests']}")
    connection = duckdb.connect(str(DATABASE), read_only=True)

    indicators = records(connection, """
        select i.*, s.source_name, s.publisher, s.homepage_url, s.citation,
               c.first_year, c.last_year, c.last_period, c.regions, c.observations
        from gold.dim_indicator as i
        join gold.dim_source as s using (source_key)
        left join (
            select f.indicator_key,
                   min(p.reference_year) as first_year, max(p.reference_year) as last_year,
                   arg_max(f.period_key, p.end_date) as last_period,
                   count(distinct f.region_code) as regions, count(*) as observations
            from gold.fct_indicator as f
            join gold.dim_period as p using (period_key)
            group by f.indicator_key
        ) as c using (indicator_key)
        order by i.domain, i.indicator_key""")
    regions = records(connection, "select * from gold.dim_region order by region_code")
    county_year = records(connection, """
        select * from gold.mart_county_year_overview order by year, region_code""")
    # The two latest national totals per indicator, on the broadest age band it publishes.
    headlines = records(connection, """
        with national as (
            select f.*, p.end_date, p.period_label, p.period_type,
                   row_number() over (partition by f.indicator_key order by
                       case when f.age_group_key in ('ALL', '15+', '15-74', '16-84', '15-69', '16+')
                            then 0 else 1 end, a.age_max - a.age_min desc nulls first) as band_rank
            from gold.fct_indicator as f
            join gold.dim_period as p using (period_key)
            join gold.dim_age_group as a using (age_group_key)
            where f.region_code = '00' and f.sex_key = 'T'
        ), band as (
            select indicator_key, any_value(age_group_key order by band_rank) as age_group_key
            from national group by indicator_key
        ), ranked as (
            select n.*, row_number() over (partition by n.indicator_key, n.period_type
                                           order by n.end_date desc) as recency
            from national as n join band using (indicator_key, age_group_key)
        ), main_type as (
            -- An indicator published monthly and yearly is shown at its finest grain.
            select indicator_key, arg_min(period_type, case period_type
                when 'month' then 1 when 'quarter' then 2 when 'year' then 3 else 4 end) as period_type
            from ranked group by indicator_key
        )
        select r.indicator_key, r.age_group_key,
               max(r.period_key) filter (where r.recency = 1) as period_key,
               max(r.period_label) filter (where r.recency = 1) as period_label,
               max(r.value) filter (where r.recency = 1) as value,
               max(r.ci_low) filter (where r.recency = 1) as ci_low,
               max(r.ci_high) filter (where r.recency = 1) as ci_high,
               max(r.period_label) filter (where r.recency = 2) as previous_period_label,
               max(r.value) filter (where r.recency = 2) as previous_value
        from ranked as r join main_type using (indicator_key, period_type)
        where r.recency <= 2
        group by r.indicator_key, r.age_group_key
        order by r.indicator_key""")
    row_counts = {table: connection.execute(f"select count(*) from gold.{table}").fetchone()[0]
                  for table in ("fct_indicator", "fct_labour_force", "fct_population",
                                "fct_sick_pay_rate", "fct_sick_leave_cases", "fct_health_survey",
                                "fct_social_survey_country", "fct_social_survey_region",
                                "fct_kolada", "mart_county_year_overview")}

    write_json(OUT / "indicators.json", clean(indicators))
    write_json(OUT / "regions.json", clean(regions))
    write_json(OUT / "county-year.json", clean(county_year))
    write_json(OUT / "headlines.json", clean(headlines))

    if PARQUET.exists():
        shutil.rmtree(PARQUET)
    parquet_rows = {}
    for source in SOURCES:
        target = PARQUET / f"source={source}/part-0.parquet"
        target.parent.mkdir(parents=True, exist_ok=True)
        # Denormalised so the browser filters one file without joins. Snappy, not ZSTD:
        # the site's Parquet reader (hyparquet) decodes Snappy without an extra codec.
        connection.execute(f"""
            copy (
                select f.indicator_key, i.indicator_name, i.domain, i.unit,
                       f.region_code, r.region_name, r.region_level, r.county_code,
                       f.period_key, p.period_type, p.reference_year, p.start_date, p.end_date,
                       f.sex_key, f.age_group_key, f.value, f.ci_low, f.ci_high, f.sample_size
                from gold.fct_indicator as f
                join gold.dim_indicator as i using (indicator_key)
                join gold.dim_region as r using (region_code)
                join gold.dim_period as p using (period_key)
                where i.source_key = '{source}'
                order by f.indicator_key, r.region_level, f.region_code, p.start_date
            ) to '{target.as_posix()}' (format parquet, compression snappy, row_group_size 50000)""")
        parquet_rows[source] = connection.execute(
            f"select count(*) from read_parquet('{target.as_posix()}')").fetchone()[0]

    run = {
        "exported_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "github_run": {key: os.environ.get(env) for key, env in (
            ("id", "GITHUB_RUN_ID"), ("sha", "GITHUB_SHA"), ("workflow", "GITHUB_WORKFLOW"))},
        "dbt": dbt,
        "sources": fetch_log(),
        "rows": row_counts,
        "parquet_rows": parquet_rows,
    }
    write_json(OUT / "run.json", run, indent=1)
    print(f"welfare: {len(indicators)} indicators, {len(headlines)} headlines, "
          f"{sum(parquet_rows.values())} Parquet rows, dbt tests {dbt['tests']}")


if __name__ == "__main__":
    main()
