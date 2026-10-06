"""Export the whole job market since 2020 to the site.

    python platform/publish/export_market.py

Writes frontend/public/data/jobs/market.json from the gold market models (dbt tag:market):

    monthly      new ads and vacancies per month, per occupation field and for all fields
    fields       the occupation fields
    occupations  every occupation group (SSYK 4) with its ads per year, in full and over the
                 months the latest year covers (year to date)
    regions      ads per county and year, for all fields and per field, in full and year to date
    conditions   per year and field: ads by employment type, working hours, required experience
    archives     the archives counted, with their source and SHA-256
    daily        new ads per publication day and field from JobTech's stream, for the days
                 it has read whole (preliminary until the quarter's archive is published)
    preliminary  the months counted from the stream rather than an archive
"""
from __future__ import annotations

import os
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))

import duckdb  # noqa: E402

from common import PUBLIC, ROOT, write_json  # noqa: E402

DATABASE = Path(os.environ.get("PORTFOLIO_DB", ROOT / "warehouse/portfolio.duckdb"))
OUT = PUBLIC / "jobs/market.json"


def rows(connection, sql: str) -> list[tuple]:
    return connection.execute(sql).fetchall()


def main() -> None:
    connection = duckdb.connect(str(DATABASE), read_only=True)
    latest_year, last_month = rows(connection, "select * from gold.int_market_periods")[0]
    years = [y for (y,) in rows(connection, """
        select distinct year(month) from gold.mart_market_field_monthly order by 1""")]

    fields = [{"id": f, "name": n, "groups": g} for f, n, g in rows(connection, """
        select field_id, field, occupation_groups from gold.dim_market_field order by field""")]

    monthly: dict[str, list] = defaultdict(list)
    for month, field, ads, vacancies in rows(connection, """
            select strftime(month, '%Y-%m'), field_id, ads, vacancies
            from gold.mart_market_field_monthly order by month"""):
        monthly[field].append([month, ads, vacancies])

    occupations: dict[str, dict] = {}
    for year, group, ssyk, name, field, ads, ads_ytd in rows(connection, """
            select year, group_id, ssyk, occupation_group, field_id, ads, ads_ytd
            from gold.mart_market_occupation_yearly order by group_id, year"""):
        o = occupations.setdefault(group, {"id": group, "ssyk": ssyk, "name": name,
                                           "field": field, "ads": {}, "ytd": {}})
        o["ads"][year] = ads
        o["ytd"][year] = ads_ytd

    regions: dict[str, dict] = {}
    for year, region, field, ads, ads_ytd in rows(connection, """
            select year, region, field_id, ads, ads_ytd from gold.mart_market_region_yearly
            order by region, year"""):
        r = regions.setdefault(region, {"region": region, "ads": {}, "ytd": {}})
        r["ads"].setdefault(field, {})[year] = ads
        r["ytd"].setdefault(field, {})[year] = ads_ytd

    conditions: dict = defaultdict(lambda: defaultdict(lambda: {
        "employment": defaultdict(int), "hours": defaultdict(int), "experience": defaultdict(int)}))
    for year, field, employment, hours, experience, ads in rows(connection, """
            select year, field_id, employment_type, working_hours, experience_required, ads
            from gold.mart_market_conditions_yearly"""):
        c = conditions[year][field]
        c["employment"][employment] += ads
        c["hours"][hours] += ads
        c["experience"]["yes" if experience else "no" if experience is False else "unknown"] += ads

    daily: dict[str, list] = defaultdict(list)
    for day, field, ads, vacancies in rows(connection, """
            select strftime(day, '%Y-%m-%d'), field_id, ads, vacancies
            from gold.mart_market_daily order by day"""):
        daily[field].append([day, ads, vacancies])
    preliminary = [m for (m,) in rows(connection, """
        select distinct strftime(month, '%Y-%m') from gold.mart_market_field_monthly
        where preliminary order by 1""")]

    archives = [{"archive": a, "source_url": u, "sha256": s, "ads": n}
                for a, u, s, n in rows(connection, """
                    select archive, source_url, sha256, ads from gold.mart_market_archives
                    order by archive""")]

    write_json(OUT, {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "years": years,
        "latest_year": latest_year,
        "ytd_months": last_month,
        "last_month": monthly["all"][-1][0],
        "fields": fields,
        "monthly": monthly,
        "occupations": sorted(occupations.values(), key=lambda o: o["name"]),
        "regions": sorted(regions.values(), key=lambda r: r["region"]),
        "conditions": conditions,
        "archives": archives,
        "daily": daily,
        "preliminary": preliminary,
        "method": ("Every ad in Arbetsförmedlingen's historical archives (JobTech) from 2020, "
                   "counted by the month it was published, its occupation group (SSYK 4) and "
                   "field, and its workplace county. Each archive counts only its own year or "
                   "quarter. After the latest archive, ads are counted daily from JobTech's "
                   "stream, from its first run on; those days and months are preliminary until "
                   "the quarter's archive is published. An ad is not a hire; an ad without a "
                   "number of vacancies counts as one. The latest year is partial, so changes "
                   "compare the same complete months."),
    })
    total = sum(n for _, n, _ in monthly["all"])
    print(f"market: {total:,} ads {years[0]}-{monthly['all'][-1][0]}, {len(fields)} fields, "
          f"{len(occupations)} occupation groups, {len(regions)} counties")


if __name__ == "__main__":
    main()
