"""Fetch what Swedish official statistics publish: SCB's table catalogue and Kolada's key figures.

Only catalogue metadata is fetched (table titles, subject paths, first and last period, time
unit, variable names; KPI titles, operating area, geography type), never the statistics. The
SWEDEN Politics of Measurement product counts these to describe which parts of social life
are measured, how often and at which geographic resolution.

SCB's tables carry their variable names but not their region level, so the metadata of every
table with a region variable is fetched too; its region codes say whether the table reaches
municipalities (four digits), counties (two) or only the country.

Writes warehouse/raw/catalogue/: `scb/tables-NNN.json`, `scb/metadata/<id>.json`,
`kolada/kpi-NNN.json`. SCB's statistical database is CC0; Kolada's API is open data from RKA.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "lib"))

import rawstore  # noqa: E402
from rawstore import fetch, session  # noqa: E402

SOURCE = "catalogue"
SCB = "https://statistikdatabasen.scb.se/api/v2"
KOLADA = "https://api.kolada.se/v3"
PAGE = 1000
MAX_AGE_DAYS = 6  # the weekly run refetches; a rerun the same week reuses


def pages(http, prefix: str, first_url: str, items: str, next_of) -> list[Path]:
    """Follow a paginated listing to its last page, sealing the set only when it completed."""
    request, group = {"url": first_url}, f"{prefix}/listing"
    cached = rawstore.completed_paths(SOURCE, group, request, MAX_AGE_DAYS)
    if cached:
        return cached
    rawstore.invalidate(SOURCE, group)
    url, number, paths = first_url, 1, []
    while url:
        path = fetch(http, SOURCE, f"{prefix}-{number:03d}.json", url, pause=0.4)
        data = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(data.get(items), list):
            raise ValueError(f"Incomplete catalogue page: {url}")
        paths.append(path)
        url, number = next_of(data, number), number + 1
    for stale in set(path.parent.glob(f"{Path(prefix).name}-*.json")) - set(paths):
        stale.unlink()
    rawstore.complete(SOURCE, group, paths, request)
    return paths


def scb_next(data: dict, number: int) -> str | None:
    total = data["page"]["totalPages"]
    return f"{SCB}/tables?lang=sv&pageSize={PAGE}&pageNumber={number + 1}" if number < total else None


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--no-metadata", action="store_true", help="Skip SCB table metadata")
    args = parser.parse_args()
    http = session()
    tables = pages(http, "scb/tables", f"{SCB}/tables?lang=sv&pageSize={PAGE}&pageNumber=1",
                   "tables", scb_next)
    kpis = pages(http, "kolada/kpi", f"{KOLADA}/kpi?per_page=5000", "values",
                 lambda data, _: data.get("next_url"))
    listed = [t for p in tables for t in json.loads(p.read_text(encoding="utf-8"))["tables"]]
    regional = [t["id"] for t in listed if any("region" in v.lower() for v in t["variableNames"])]
    print(f"catalogue: {len(listed)} SCB tables ({len(regional)} with a region variable), "
          f"{len(kpis)} Kolada page(s)")
    if args.no_metadata:
        return
    keep = set()
    for number, table in enumerate(regional, 1):
        relative = f"scb/metadata/{table}.json"
        keep.add(relative)
        # SCB allows 30 requests per 10 seconds; table metadata changes rarely.
        fetch(http, SOURCE, relative, f"{SCB}/tables/{table}/metadata?lang=sv",
              pause=0.4, max_age_days=30)
        if number % 200 == 0:
            print(f"catalogue: metadata {number}/{len(regional)}", flush=True)
    for stale in (rawstore.RAW / SOURCE / "scb/metadata").glob("*.json"):
        if f"scb/metadata/{stale.name}" not in keep:
            stale.unlink()


if __name__ == "__main__":
    main()
