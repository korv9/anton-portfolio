"""Fetch Region Stockholm's population projection per planning area (Befolkningsprognos 2026,
"data för planområden") and keep residents per planning area and year.

The workbook gives projected residents per planning area, age group, sex and year, 2025–2035
(2025 is the observed start). No licence is stated, so the workbook stays on this machine
(warehouse_store LOCAL_ONLY) and only the sums per area and year are kept and pushed.

Writes warehouse/raw/rs_prognos/: prognos_2026.xlsx as fetched (provenance in the fetch log) and
residents.csv with planning_area_code, planning_area, municipality_code, municipality, year,
residents.
"""
from __future__ import annotations

import csv
import re
from collections import defaultdict

from openpyxl import load_workbook

from portfolio.storage import rawstore
from portfolio.storage.rawstore import fetch, session

SOURCE = "rs_prognos"
URL = ("https://www.regionstockholm.se/4a4528/contentassets/aa74275c617c4ba4b7b1404a60d4a2c5/"
       "data-for-planomraden-prognos-2026.xlsx")
HEADER = ("Planområde", "Kommunkod", "Kommun", "Åldersgrupp", "Kön", "År", "Befolkning")


def sums(path) -> dict[tuple, float]:
    sheet = next(ws for ws in load_workbook(path, read_only=True).worksheets if ws.max_column == len(HEADER))
    rows = sheet.iter_rows(values_only=True)
    if tuple(next(rows)) != HEADER:
        raise ValueError("rs_prognos: the planning-area sheet's header changed")
    out: dict[tuple, float] = defaultdict(float)
    for area, kommunkod, kommun, _age, _sex, year, value in rows:
        if not area and value is None:  # the sheet ends in empty, formatted rows
            continue
        code = re.match(r"PL-\d{4}", area)
        if not code:
            raise ValueError(f"rs_prognos: unexpected planning area {area!r}")
        out[(code.group(), area[code.end():].strip(), kommunkod, kommun, int(year))] += float(value)
    return out


def main() -> None:
    path = fetch(session(), SOURCE, "prognos_2026.xlsx", URL, max_age_days=90)
    totals = sums(path)
    years = sorted({k[4] for k in totals})
    if years[0] != 2025 or years[-1] < 2035 or len({k[0] for k in totals}) < 200:
        raise ValueError(f"rs_prognos: unexpected coverage {years[0]}–{years[-1]}")
    out = rawstore.RAW / SOURCE / "residents.csv"
    with out.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle, lineterminator="\n")
        writer.writerow(["planning_area_code", "planning_area", "municipality_code", "municipality", "year", "residents"])
        writer.writerows([*k, round(v, 1)] for k, v in sorted(totals.items()))
    print(f"rs_prognos: {len({k[0] for k in totals})} planning areas, {years[0]}–{years[-1]}")


if __name__ == "__main__":
    main()
