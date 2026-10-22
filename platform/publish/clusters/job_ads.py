"""One pass over the local JobTech cluster corpus for the job-ad clusterings (plan items 1 and 2).

    python platform/publish/clusters/job_ads.py

Reads raw/jobtech/cluster-corpus/{2023,2024,2025,2026-Q*}/*.parquet (the active snapshot repeats
ads already in the quarters and is left out) with DuckDB at memory_limit 1GB and two threads,
spilling to tmp/duckdb, reading six columns. An ad counts once per observation_id. Writes
features/clusters/job-ads:
- municipality_field.parquet: publication year x municipality name x county x occupation field;
- occupation_month.parquet: month x occupation group x occupation field.
Names stay as JobTech spells them; gold.mart_job_ad_municipality_field maps them to SCB codes
through dim_municipality and mart_job_ad_unmatched_municipalities counts what does not map.
No ad text, title or employer leaves the scan.
"""
from __future__ import annotations

import json
import os
from pathlib import Path

import duckdb

import stats

CORPUS = Path(os.environ.get("PORTFOLIO_RAW", stats.ROOT / "warehouse/raw")) / "jobtech/cluster-corpus"
FOLDERS = ("2023", "2024", "2025", "2026-Q*")
OUT = stats.FEATURES / "job-ads"


def main() -> None:
    files = [(CORPUS / f / "*.parquet").as_posix() for f in FOLDERS]
    OUT.mkdir(parents=True, exist_ok=True)
    spill = stats.ROOT / "tmp/duckdb"
    spill.mkdir(parents=True, exist_ok=True)
    con = duckdb.connect()
    for setting in ("memory_limit='1GB'", "threads=2", "preserve_insertion_order=false",
                    f"temp_directory='{spill.as_posix()}'"):
        con.execute(f"set {setting}")
    print("memory_limit", con.execute("select current_setting('memory_limit')").fetchone()[0])
    # published_at is an ISO string (VARCHAR) in the corpus, so its first seven characters are the month.
    con.sql(f"""create temp table ads as
        select observation_id, any_value(published_at)[:7] as month, any_value(municipality) as municipality,
               any_value(region) as region, any_value(occupation_field) as occupation_field,
               any_value(occupation_group) as occupation_group
        from read_parquet({files})
        group by observation_id""")
    con.sql(f"""copy (select month[:4]::int as year, municipality, region, occupation_field, count(*) as ads
                      from ads group by all order by all)
                to '{(OUT / "municipality_field.parquet").as_posix()}' (format parquet)""")
    con.sql(f"""copy (select month, occupation_group, occupation_field, count(*) as ads
                      from ads group by all order by all)
                to '{(OUT / "occupation_month.parquet").as_posix()}' (format parquet)""")
    counts = dict(zip(["ads", "without_municipality", "first_month", "last_month"], con.sql(
        "select count(*), count(*) - count(municipality), min(month), max(month) from ads").fetchone()))
    counts["folders"] = list(FOLDERS)
    (OUT / "manifest.json").write_text(json.dumps(counts, indent=1) + "\n", encoding="utf-8", newline="\n")
    print(counts)


if __name__ == "__main__":
    main()
