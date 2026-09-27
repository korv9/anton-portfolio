"""Fetch the selected Kolada key figures for every municipality, county and the country.

Kolada (RKA) republishes figures from SCB, Försäkringskassan, Folkhälsomyndigheten, Brå and
others per municipality (`KKKK`), per county as region (`00LL`) and for the country
(`0000`), split by sex (`T`, `K`, `M`). The selection is `seeds/welfare/kolada_kpis.csv`,
which dbt also reads to classify each figure, so the two cannot drift apart.

Writes warehouse/raw/kolada/: `municipality.json`, and per KPI its metadata and data pages.
"""
from __future__ import annotations

import argparse
import csv
import json
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "lib"))

import rawstore  # noqa: E402
from rawstore import fetch, session  # noqa: E402

API = "https://api.kolada.se/v3"
SOURCE = "kolada"
SEED = Path(__file__).resolve().parents[2] / "seeds/welfare/kolada_kpis.csv"
FIRST_YEAR = 1990
YEARS_PER_REQUEST = 25  # the API refuses longer year lists


def selected_kpis() -> list[str]:
    with SEED.open(encoding="utf-8") as handle:
        return [row["kpi_id"] for row in csv.DictReader(handle)]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--only", nargs="*", help="Fetch only these KPI ids")
    args = parser.parse_args()
    http = session()
    fetch(http, SOURCE, "municipality.json", f"{API}/municipality", pause=0.3)
    years = list(range(FIRST_YEAR, date.today().year + 1))
    blocks = [years[i:i + YEARS_PER_REQUEST] for i in range(0, len(years), YEARS_PER_REQUEST)]
    for kpi in selected_kpis():
        if args.only and kpi not in args.only:
            continue
        fetch(http, SOURCE, f"{kpi}/kpi.json", f"{API}/kpi/{kpi}", pause=0.3)
        written = []
        for block in blocks:
            url, page = f"{API}/data/kpi/{kpi}/year/{','.join(map(str, block))}", 1
            while url:
                path = fetch(http, SOURCE, f"{kpi}/page-{block[0]}-{page:03d}.json", url, pause=0.3)
                written.append(path)
                url = json.loads(path.read_text(encoding="utf-8")).get("next_url")
                page += 1
        for stale in set((rawstore.RAW / SOURCE / kpi).glob("page-*.json")) - set(written):
            stale.unlink()
        print(f"kolada/{kpi}: {len(written)} page(s)")


if __name__ == "__main__":
    main()
