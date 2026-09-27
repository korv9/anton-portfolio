"""Fetch SCB tables for the welfare subject: AKU labour force and population.

- AKU by county, annual and quarterly (employment and unemployment rate, with margins).
- AKU national monthly by sex and age, unadjusted, seasonally adjusted and trend.
- Population by region (country, county, municipality) and sex, the denominator every
  per-capita comparison needs, and the source of `dim_region`'s names.

Writes PxWeb JSON parts to warehouse/raw/scb/<dataset>/.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "lib"))

from pxweb import download_table  # noqa: E402
from rawstore import session  # noqa: E402

API = "https://api.scb.se/OV0104/v1/doris/sv/ssd"
SOURCE = "scb"

# dataset name -> (table path, selections, eliminated variables)
TABLES: dict[str, tuple[str, dict, tuple]] = {
    "aku_region_year": ("AM/AM0401/AM0401N/NAKUBefolkningLAr", {}, ()),
    "aku_region_quarter": ("AM/AM0401/AM0401N/NAKUBefolkningLK", {}, ()),
    # Levels, rates and the three series types; margins and change series stay at SCB.
    "aku_month": ("AM/AM0401/AM0401A/AKURLBefM", {
        "TypData": ["O_DATA", "SR_DATA", "TC_DATA"],
    }, ()),
    # 1968-2024; the current year is published in a separate table, below.
    "population_year": ("BE/BE0101/BE0101A/BefolkningNy", {
        "ContentsCode": ["BE0101N1"],
    }, ("Civilstand", "Alder")),
    # The current-year table publishes its totals as codes instead of allowing elimination.
    "population_year_current": ("BE/BE0101/BE0101A/BefolkningCKM", {
        "Civilstand": ["SC"], "Alder": ["TotSA"], "Kon": ["1", "2"], "ContentsCode": ["000007ME"],
    }, ()),
}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--only", nargs="*", choices=sorted(TABLES), help="Fetch only these datasets")
    args = parser.parse_args()
    http = session()
    for dataset, (path, selections, eliminate) in TABLES.items():
        if args.only and dataset not in args.only:
            continue
        # SCB allows 30 requests per 10 seconds; half a second between calls stays well inside.
        parts = download_table(http, SOURCE, dataset, f"{API}/{path}", selections,
                               eliminate=eliminate, pause=0.5)
        print(f"scb/{dataset}: {len(parts)} part(s)")


if __name__ == "__main__":
    main()
