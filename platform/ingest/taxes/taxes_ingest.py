"""Fetch the tax sources: revenue by type, labour taxation by country, and Swedish rates.

    python platform/ingest/taxes/taxes_ingest.py

OECD (SDMX), under warehouse/raw/oecd/:
    revenue.csv.gz          Revenue Statistics, comparative tables: tax revenue of general
                            government by revenue category (1000 income ... 6000 other), as a
                            share of GDP and in national currency, every OECD country, 1965-
    taxing_wages.csv.gz     Taxing Wages, comparative indicators: tax wedge, average and marginal
                            rates, net income, per household type and wage level, 2000-

Skatteverket (open data rowstore), under warehouse/raw/skatteverket/:
    municipal_rates/part-NN.json   municipal and regional tax, burial fee and church fee per
                                   parish, every year Skatteverket publishes
    withholding/<year>-NN.json     the monthly withholding tables (skattetabeller) of the
                                   current income year; the tax calculator is tested against them
"""
from __future__ import annotations

import json
import sys
import urllib.parse
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "lib"))

import rawstore  # noqa: E402

OECD = "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS"
REVENUE = (f"{OECD},DSD_REV_COMP_OECD@DF_RSOECD,2.0/.TAX_REV.S13.._T.PT_B1GQ+XDC.A"
           "?startPeriod=1965&format=csvfilewithlabels")
TAXING_WAGES = (f"{OECD},DSD_TAX_WAGES_COMP@DF_TW_COMP,2.1/all"
                "?startPeriod=2000&format=csvfilewithlabels")
ROWSTORE = "https://skatteverket.entryscape.net/rowstore/dataset"
MUNICIPAL_RATES = "c67b320b-ffee-4876-b073-dd9236cd2a99"
WITHHOLDING_TABLES = "88320397-5c32-4c16-ae79-d36d95b17b95"
# The first year of the withholding tables in Skatteverket's open data.
FIRST_TABLE_YEAR = 2016
PAGE = 500


def rowstore_pages(http, dataset: str, target: str, filters: dict) -> int:
    """Every page of a rowstore query, one file per page, stale pages removed."""
    offset, index, paths = 0, 0, []
    while True:
        query = urllib.parse.urlencode({**filters, "_limit": PAGE, "_offset": offset})
        url = f"{ROWSTORE}/{dataset}/json?{query}"
        path = rawstore.fetch(http, "skatteverket", f"{target}-{index:03d}.json", url, pause=0.2)
        page = json.loads(path.read_text(encoding="utf-8"))
        paths.append(path)
        offset += PAGE
        index += 1
        if offset >= page["resultCount"]:
            break
    directory = paths[0].parent
    prefix = Path(target).name
    for stale in set(directory.glob(f"{prefix}-*.json")) - set(paths):
        stale.unlink()
    return page["resultCount"]


def main() -> None:
    http = rawstore.session()
    for name, url in (("revenue", REVENUE), ("taxing_wages", TAXING_WAGES)):
        response = http.get(url, timeout=600)
        response.raise_for_status()
        rawstore.store("oecd", f"{name}.csv.gz", response.content, url=url)
        print(f"oecd/{name}: {len(response.content) / 1e6:.1f} MB", flush=True)

    rates = rowstore_pages(http, MUNICIPAL_RATES, "municipal_rates/part", {})
    print(f"skatteverket/municipal_rates: {rates:,} parish-year rows", flush=True)

    # Every year Skatteverket publishes tables for, 2016 on: the calculator is tested
    # against each year's rules. A past year's tables do not change once stored.
    this_year = date.today().year
    for year in range(FIRST_TABLE_YEAR, this_year + 1):
        stored = sorted((rawstore.RAW / "skatteverket" / "withholding").glob(f"{year}-*.json"))
        if stored and year < this_year:
            continue
        tables = rowstore_pages(http, WITHHOLDING_TABLES, f"withholding/{year}",
                                {"år": str(year), "antal dgr": "30B"})
        print(f"skatteverket/withholding {year}: {tables:,} rows", flush=True)


if __name__ == "__main__":
    main()
