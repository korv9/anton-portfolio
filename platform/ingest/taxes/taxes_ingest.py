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

SCB_HUT = "https://api.scb.se/OV0104/v1/doris/sv/ssd/HE/HE0201/HE0201D/HUThush"
# SCB, Hushållens utgifter (HUT) 2021: spending per household type and group of goods and
# services, kronor per household. The latest survey; the VAT estimate on the site uses it.
HUT_QUERY = {
    "query": [
        {"code": "ContentsCode", "selection": {"filter": "item", "values": ["0000043B"]}},
        {"code": "Tid", "selection": {"filter": "item", "values": ["2021"]}},
    ],
    "response": {"format": "json"},
}

SKATTEVERKET = "https://www.skatteverket.se"
# Skatteverket's "Belopp och procent" for private persons, one page per income year: the
# amounts behind the rules in frontend/src/taxes/rules.ts that are not in the withholding
# tables (employer and self-employment contributions, property fee, ISK, VAT, state loan rate).
AMOUNTS_PAGES = {
    2006: "/privat/skatter/beloppochprocent/tidigarear/2006.4.dfe345a107ebcc9baf800010641.html",
    2007: "/privat/skatter/beloppochprocent/tidigarear/2007.4.7459477810df5bccdd4800032404.html",
    2008: "/privat/skatter/beloppochprocent/tidigarear/2008.4.19b9f599116a9e8ef3680001800.html",
    2009: "/privat/skatter/beloppochprocent/tidigarear/2009.4.6d02084411db6e252fe80007428.html",
    2010: "/privat/skatter/beloppochprocent/tidigarear/2010.4.76a43be412206334b89800047590.html",
    2011: "/privat/skatter/beloppochprocent/tidigarear/2011.4.6eb1f7eb12c507b23b780005839.html",
    2012: "/privat/skatter/beloppochprocent/tidigarear/2012.4.5fc8c94513259a4ba1d800031879.html",
    2013: "/privat/skatter/beloppochprocent/tidigarear/2013.4.2b543913a42158acf800010110.html",
    2014: "/privat/skatter/beloppochprocent/tidigarear/2014.4.46ae6b26141980f1e2d4366.html",
    2015: "/privat/skatter/beloppochprocent/tidigarear/2015.4.3f4496fd14864cc5ac9c64b.html",
    2016: "/privat/skatter/beloppochprocent/tidigarear/2016.4.3810a01c150939e893f737e.html",
    2017: "/privat/skatter/beloppochprocent/2017.4.5c1163881590be297b524b9.html",
    2018: "/privat/skatter/beloppochprocent/2018.4.4a4d586616058d860bcf48.html",
    2019: "/privat/skatter/beloppochprocent/2019.4.309a41aa1672ad0c837788f.html",
    2020: "/privat/skatter/beloppochprocent/2020.4.7eada0316ed67d728238ec.html",
    2021: "/privat/skatter/beloppochprocent/2021.4.5b35a6251761e6914204479.html",
    2022: "/privat/skatter/beloppochprocent/2022.4.339cd9fe17d1714c0774742.html",
    2023: "/privat/skatter/beloppochprocent/2023.4.1997e70d1848dabbac91bc9.html",
    2024: "/privat/skatter/beloppochprocent/2024.4.7da1d2e118be03f8e4f4a88.html",
    2025: "/privat/skatter/beloppochprocent/2025.4.262c54c219391f2e96342eb.html",
    2026: "/privat/skatter/beloppochprocent/2026.4.1522bf3f19aea8075ba21.html",
}


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

    rawstore.fetch(http, "scb", "hut/hushallstyp-2021.json", SCB_HUT, method="POST",
                   body=HUT_QUERY)
    print("scb/hut: household spending 2021", flush=True)

    for year, path in AMOUNTS_PAGES.items():
        rawstore.fetch(http, "skatteverket", f"amounts/{year}.html", SKATTEVERKET + path,
                       pause=0.3)
    print(f"skatteverket/amounts: {len(AMOUNTS_PAGES)} years", flush=True)

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
