"""Fetch SCB's DeSO statistics and boundaries for Stockholm County (CC0).

SCB publishes each year on the division in force then: figures up to 2023 on DeSO 2018 (plain
codes, `0114A0010`), from 2024 on DeSO 2025 (`0114A0010_DeSO2025`). Both are fetched, with both
divisions' boundaries.

- Residents per DeSO and year, 2013 on: BE0101Y FolkmDesoAldKon, all ages, both sexes.
- Employed residents aged 15–74 per DeSO and year, 2020 on: AM0210G ArRegDesoStatusN. SCB counts
  them where they live (nattbefolkning); open DeSO statistics have no count of who works there.
- DeSO 2018 and 2025 boundaries and SCB's retail areas (handelsområden 2020, with their employees) from
  SCB's open WFS (geodata.scb.se), in SWEREF99 TM.

Writes warehouse/raw/scb_deso/: <dataset>/metadata.json and part-NNN.json (PxWeb JSON), and
deso_2018.geojson, deso_2025.geojson, retail_2020.geojson.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "lib"))

from pxweb import download_table  # noqa: E402
from portfolio.storage.rawstore import fetch, session  # noqa: E402

SOURCE = "scb_deso"
API = "https://api.scb.se/OV0104/v1/doris/sv/ssd"
WFS = ("https://geodata.scb.se/geoserver/stat/wfs?service=WFS&version=2.0.0&request=GetFeature"
       "&typeNames=stat:{layer}&outputFormat=application/json&CQL_FILTER=lanskod%3D%2701%27")
FIRST_YEAR = 2013
COUNTY = "01"


def county_deso(http, path: str) -> list[str]:
    """The table's DeSO 2018 and DeSO 2025 codes in Stockholm County."""
    meta = json.loads(fetch(http, SOURCE, f"{path.rsplit('/', 1)[1]}/codes.json", f"{API}/{path}").read_text("utf-8-sig"))
    region = next(v for v in meta["variables"] if v["code"] == "Region")
    codes = [c for c in region["values"] if re.fullmatch(rf"{COUNTY}\d\d[A-C]\d{{4}}(_DeSO2025)?", c)]
    if sum(c.endswith("_DeSO2025") for c in codes) < 1000 or sum(not c.endswith("_DeSO2025") for c in codes) < 1000:
        raise ValueError(f"{path}: {len(codes)} DeSO in Stockholm County")
    return codes


def years(http, path: str) -> list[str]:
    meta = json.loads(fetch(http, SOURCE, f"{path.rsplit('/', 1)[1]}/codes.json", f"{API}/{path}").read_text("utf-8-sig"))
    return [t for t in next(v for v in meta["variables"] if v["code"] == "Tid")["values"] if int(t) >= FIRST_YEAR]


def features(payload: bytes) -> None:
    data = json.loads(payload)
    if not data.get("features") or data.get("numberReturned", len(data["features"])) != len(data["features"]):
        raise ValueError("WFS answer without features or cut short")


def main() -> None:
    http = session()
    residents = "BE/BE0101/BE0101Y/FolkmDesoAldKon"
    employed = "AM/AM0210/AM0210G/ArRegDesoStatusN"
    tables = {
        "residents": (residents, {"Region": county_deso(http, residents), "Alder": ["totalt"], "Kon": ["1+2"],
                                  "Tid": years(http, residents)}),
        "employed": (employed, {"Region": county_deso(http, employed), "Alder": ["15-74"], "Kon": ["1+2"],
                                "ContentsCode": ["0000089X"], "Tid": years(http, employed)}),
    }
    for dataset, (path, selections) in tables.items():
        parts = download_table(http, SOURCE, dataset, f"{API}/{path}", selections, pause=0.5)
        print(f"scb_deso/{dataset}: {len(parts)} part(s)")
    for name, layer in (("deso_2018.geojson", "DeSO_2018"), ("deso_2025.geojson", "DeSO_2025"),
                        ("retail_2020.geojson", "Handelsomraden_2020")):
        fetch(http, SOURCE, name, WFS.format(layer=layer), timeout=300, max_age_days=90, validate=features)
        print(f"scb_deso/{name}")


if __name__ == "__main__":
    main()
