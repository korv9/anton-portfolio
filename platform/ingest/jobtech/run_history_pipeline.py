"""Rebuild the job-market report from JobTech's archives and stream, in dependency order.

    python platform/ingest/jobtech/run_history_pipeline.py              # 2020 to yesterday
    python platform/ingest/jobtech/run_history_pipeline.py --archives 2024 2025 2026-Q1
    python platform/ingest/jobtech/run_history_pipeline.py --skip-import

Steps: download and import the archives and then the stored JobStream answers after the last of
them (ingest_history --stream), dbt build of the jobs models into
warehouse/jobtech/history.duckdb, the presentation export, and a copy of the five tables
the site reads into frontend/public/data/jobs/. `npm run data:build` then rebuilds gold.
After the import it logs, once, how many archive payloads carry a removal date
(warehouse/jobtech/removal-check.json): whether a time-to-close history could be built at all.

JobTech publishes one archive per calendar year, some months after it ends, and for the current
year one per quarter (https://data.arbetsformedlingen.se/annonser/historiska/). By default every
archive from 2020 is used, quarters only for a year without its yearly archive. The stream
(ingest_stream.py, subject market) covers the days after; without it stored, they are absent.
The analysis ends in the latest month with coverage; the year comparison (presentation tables)
uses the latest two calendar years whose twelve months are all complete.
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

from ingest_market import published_archives

PLATFORM = Path(__file__).resolve().parents[2]
ROOT = PLATFORM.parent
WAREHOUSE = ROOT / "warehouse/jobtech"
SITE_TABLES = ("01_overview", "02_ads_by_year_role", "03_ads_by_month",
               "05_junior_by_month", "06_top_technologies")


def archives(names: list[str]) -> list[str]:
    """Yearly archives, and the quarters of a year that has no yearly archive yet."""
    years = {n for n in names if "-Q" not in n}
    return sorted(n for n in names if n[:4] not in years or n in years)


def coverage(database: Path) -> tuple[str, str, list[int]]:
    """First and last month with coverage, and the calendar years whose twelve months are complete."""
    import duckdb
    with duckdb.connect(str(database), read_only=True) as con:
        first, last = con.execute("select min(publication_month), max(publication_month) "
                                  "from raw.collection_coverage").fetchone()
        years = [y for (y,) in con.execute("""
            select year(publication_month) from raw.collection_coverage group by 1
            having count(*) filter (where status = 'complete') = 12 order by 1""").fetchall()]
    return first.isoformat(), last.isoformat(), years


def removal_check(database: Path) -> dict:
    """Payloads in raw.job_ads with a removal date or flag, by the field names JobTech's stream uses."""
    import duckdb
    with duckdb.connect(str(database), read_only=True) as con:
        total, removed_date, removed, removed_true = con.execute("""
            select count(*), count(payload ->> '$.removed_date'), count(payload ->> '$.removed'),
                count(*) filter (where payload ->> '$.removed' = 'true')
            from raw.job_ads""").fetchone()
    result = {"payloads": total, "removed_date_not_null": removed_date, "removed_not_null": removed,
              "removed_true": removed_true}
    (database.parent / "removal-check.json").write_text(json.dumps(result, indent=1) + "\n", encoding="utf-8")
    print("Removal date in archive payloads:", json.dumps(result), flush=True)
    return result


def run(arguments: list[str], env: dict) -> None:
    print("Running:", " ".join(arguments), flush=True)
    subprocess.run(arguments, cwd=PLATFORM, env=env, check=True)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--archives", nargs="+", help="Default: every published archive from 2020")
    parser.add_argument("--no-stream", action="store_true", help="Archives only")
    parser.add_argument("--skip-import", action="store_true",
                        help="Use the archives already imported into the database")
    parser.add_argument("--database", type=Path, default=WAREHOUSE / "history.duckdb")
    parser.add_argument("--directory", type=Path, default=WAREHOUSE / "archives")
    args = parser.parse_args()
    # The steps run from platform/: resolve relative paths against the caller's directory first.
    args.database, args.directory = args.database.resolve(), args.directory.resolve()

    names = archives(args.archives or published_archives())
    if not names:
        raise SystemExit("No published archive found")
    env = dict(os.environ, PORTFOLIO_DB=str(args.database), DBT_SEND_ANONYMOUS_USAGE_STATS="false")

    if not args.skip_import:
        run([sys.executable, "ingest/jobtech/ingest_history.py", "--years", *names,
             "--database", str(args.database), "--directory", str(args.directory)]
            + ([] if args.no_stream else ["--stream"]), env)
    removal_check(args.database)
    first, last, years = coverage(args.database)
    if not years:
        raise SystemExit("No calendar year with twelve complete months")
    dbt_vars = json.dumps({
        "analysis_start": first, "analysis_end": last,
        "baseline_year": years[-2] if len(years) > 1 else years[-1], "comparison_year": years[-1],
    })
    # One thread: the gold models each scan the full ad table, and in parallel their
    # temporary files outgrow a CI runner's disk.
    run([sys.executable, "-m", "dbt.cli.main", "build", "--profiles-dir", ".", "--indirect-selection", "buildable",
         "--select", "+tag:jobs", "--full-refresh", "--threads", "1", "--target-path", "target/jobs", "--vars", dbt_vars], env)
    presentation = WAREHOUSE / "presentation"
    run([sys.executable, "ingest/jobtech/export_presentation.py", "--database", str(args.database),
         "--output", str(presentation)], env)
    site = ROOT / "frontend/public/data/jobs"
    for table in SITE_TABLES:
        shutil.copyfile(presentation / f"{table}.csv", site / f"{table}.csv")
    print(f"Copied {len(SITE_TABLES)} tables for {years[0]}-{years[-1]} to {site}; "
          f"analysis {first[:7]} to {last[:7]}")


if __name__ == "__main__":
    main()
