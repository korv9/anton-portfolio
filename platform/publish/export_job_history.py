"""Export the IT ad history per period and the technology shares from the archive build.

    python platform/publish/export_job_history.py [--database warehouse/jobtech/history.duckdb]

Reads the history database that platform/ingest/jobtech/run_history_pipeline.py builds (subject
jobs_analysis) and writes to frontend/public/data/jobs/:

    ads-week.json, ads-month.json, ads-year.json
        gold.mart_job_ads_periods, one file per period kind: new ads per period and role family,
        with `complete` false for a period not every day of which was imported (never compared)
    skill-trends.json
        gold.mart_skill_trends_monthly in the latest complete month: the change in each
        technology's share of a role family's ads from the same month a year before, in
        percentage points, only where sufficient_volume holds, with the counts behind both shares
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
from pathlib import Path

import duckdb

from portfolio.core import io
from portfolio.core.config import PUBLIC, ROOT

DATABASE = ROOT / "warehouse/jobtech/history.duckdb"
OUT = PUBLIC / "jobs"
KINDS = ("week", "month", "year")
SOURCE = "Arbetsförmedlingen JobTech, historical ad archives (CC0 1.0)"


def records(connection, sql: str, params=()) -> list[dict]:
    result = connection.execute(sql, params)
    names = [d[0] for d in result.description]
    return [dict(zip(names, (v.isoformat() if hasattr(v, "isoformat") else v for v in r)))
            for r in result.fetchall()]


def periods(connection, kind: str, now: str) -> dict:
    found = records(connection, """
        select period_start, role_family, ads, days_covered, days_in_period, complete
        from gold.mart_job_ads_periods where period_kind = ? order by period_start, role_family""", [kind])
    complete = [r["period_start"] for r in found if r["complete"]]
    return {
        "schema_version": 1, "generated_at": now, "source": SOURCE,
        "model": "gold.mart_job_ads_periods", "period_kind": kind,
        "latest_complete": complete[-1] if complete else None,
        "method": ("New IT ads per " + ("ISO week, Monday to Sunday" if kind == "week" else kind)
                   + " and role family by publication day; all is every classified role (ads the "
                   "role rules leave as Other are not counted). A period is complete only when "
                   "every one of its days falls in a month whose archive was imported in full; "
                   "an incomplete period is shown as such and never compared. An ad is not a hire."),
        "rows": found,
    }


def skill_trends(connection, now: str) -> dict:
    (month,) = connection.execute("""
        select max(publication_month) from gold.mart_skill_trends_monthly where is_complete""").fetchone()
    found = records(connection, """
        select s.role_family, s.skill, s.ads_with_skill, s.total_ads, s.unique_employers,
            s.skill_share, s.previous_year_skill_ads, j.previous_year_ads as previous_year_total_ads,
            s.previous_year_share, s.share_yoy_pp
        from gold.mart_skill_trends_monthly as s
        join gold.mart_job_trends_monthly as j using (publication_month, role_family)
        where s.publication_month = ? and s.sufficient_volume and s.share_yoy_pp is not null
        order by s.role_family, s.share_yoy_pp desc, s.skill""", [month])
    return {
        "schema_version": 1, "generated_at": now, "source": SOURCE,
        "model": "gold.mart_skill_trends_monthly",
        "month": month.isoformat()[:7] if month else None,
        "method": ("Per role family and technology in the latest complete month: the share of the "
                   "role's ads that name the technology, against the same month a year before, "
                   "in percentage points (share_yoy_pp). Only rows with sufficient volume (at least "
                   "20 ads of the role and five naming the technology) and a complete month a year "
                   "before; a descriptive threshold, not a significance test."),
        "rows": found,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--database", type=Path, default=DATABASE)
    parser.add_argument("--out", type=Path, default=OUT)
    args = parser.parse_args()
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    connection = duckdb.connect(str(args.database), read_only=True)
    files = {f"ads-{kind}.json": periods(connection, kind, now) for kind in KINDS}
    files["skill-trends.json"] = skill_trends(connection, now)
    connection.close()
    if empty := [name for name, value in files.items() if not value["rows"]]:
        raise SystemExit(f"No rows for {', '.join(empty)}; nothing written")
    for name, value in files.items():
        io.write_json(args.out / name, value, newline=False)
        print(f"{args.out / name}: {len(value['rows'])} rows")


if __name__ == "__main__":
    main()
