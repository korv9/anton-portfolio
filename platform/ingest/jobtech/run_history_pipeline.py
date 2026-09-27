"""Rebuild the job-market report from JobTech's yearly archives, in dependency order.

    python platform/ingest/jobtech/run_history_pipeline.py              # every complete year
    python platform/ingest/jobtech/run_history_pipeline.py --years 2023 2024 2025
    python platform/ingest/jobtech/run_history_pipeline.py --skip-import

Steps: download and import the archives (ingest_history), dbt build of the jobs models into
warehouse/jobtech/history.duckdb, the presentation export, and a copy of the five tables
the site reads into frontend/public/data/jobs/. `npm run data:build` then rebuilds gold.

JobTech publishes one archive per calendar year, some months after it ends. By default
every year from 2022 to the latest published one is used; the report's comparison year
follows the data.
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
from datetime import date
from pathlib import Path

import requests

PLATFORM = Path(__file__).resolve().parents[2]
ROOT = PLATFORM.parent
WAREHOUSE = ROOT / "warehouse/jobtech"
ARCHIVE_URL = "https://data.arbetsformedlingen.se/annonser/historiska/{year}.jsonl.zip"
FIRST_YEAR = 2022
SITE_TABLES = ("01_overview", "02_ads_by_year_role", "03_ads_by_month",
               "05_junior_by_month", "06_top_technologies")


def published_years() -> list[int]:
    """Every year from FIRST_YEAR whose archive JobTech has published."""
    years = []
    for year in range(FIRST_YEAR, date.today().year + 1):
        response = requests.head(ARCHIVE_URL.format(year=year), timeout=60, allow_redirects=True)
        if response.status_code == 200:
            years.append(year)
        elif response.status_code != 404:
            response.raise_for_status()
    return years


def run(arguments: list[str], env: dict) -> None:
    print("Running:", " ".join(arguments), flush=True)
    subprocess.run(arguments, cwd=PLATFORM, env=env, check=True)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--years", nargs="+", type=int, help="Default: every published year")
    parser.add_argument("--skip-import", action="store_true",
                        help="Use the archives already imported into the database")
    parser.add_argument("--database", type=Path, default=WAREHOUSE / "history.duckdb")
    parser.add_argument("--archives", type=Path, default=WAREHOUSE / "archives")
    args = parser.parse_args()

    years = sorted(args.years or published_years())
    if not years:
        raise SystemExit("No published archive year found")
    comparison, baseline = years[-1], years[-2] if len(years) > 1 else years[-1]
    env = dict(os.environ, PORTFOLIO_DB=str(args.database), DBT_SEND_ANONYMOUS_USAGE_STATS="false")
    dbt_vars = json.dumps({
        "analysis_start": f"{years[0]}-01-01",
        "analysis_end": f"{years[-1]}-12-01",
        "baseline_year": baseline,
        "comparison_year": comparison,
    })

    if not args.skip_import:
        run([sys.executable, "ingest/jobtech/ingest_history.py", "--years", *map(str, years),
             "--database", str(args.database), "--directory", str(args.archives)], env)
    # One thread: the gold models each scan the full ad table, and in parallel their
    # temporary files outgrow a CI runner's disk.
    run([sys.executable, "-m", "dbt.cli.main", "build", "--profiles-dir", ".", "--select", "+tag:jobs",
         "--full-refresh", "--threads", "1", "--target-path", "target/jobs", "--vars", dbt_vars], env)
    presentation = WAREHOUSE / "presentation"
    run([sys.executable, "ingest/jobtech/export_presentation.py", "--database", str(args.database),
         "--output", str(presentation), "--first-year", str(years[0]),
         "--last-year", str(years[-1])], env)
    site = ROOT / "frontend/public/data/jobs"
    for table in SITE_TABLES:
        shutil.copyfile(presentation / f"{table}.csv", site / f"{table}.csv")
    print(f"Copied {len(SITE_TABLES)} tables for {years[0]}-{years[-1]} to {site}")


if __name__ == "__main__":
    main()
