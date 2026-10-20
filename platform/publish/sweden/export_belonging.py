"""Publish SWEDEN D, The Infrastructure of Belonging: public libraries as places to take part
without buying anything, per municipality, from KB's official library statistics.

    python platform/publish/sweden/export_belonging.py

Inputs: KB's library statistics (bibstat, CC0) for staffed service points, physical visits,
public activities and active borrowers per library organisation and year; KB's Biblioteksdatabasen
for each organisation's municipality and the public libraries' coordinates; the municipal
population (gold.mart_municipality_year_panel, or its published Parquet when the warehouse is not
on this machine); SCB's boundaries for each municipality's land area; the groups of C.

Writes frontend/public/data/sweden/belonging/:
- `municipalities.json`: per municipality and year, the four measures and their rates per
  inhabitant; land area; and the share of years reported.
- `libraries.json`: public libraries in Biblioteksdatabasen with coordinates in SWEREF99 TM
  (100 m), name and municipality. No contact details.
- `coverage.json`: what was joined, what was left out and why.

Availability (service points, opening) and participation (visits, activities, borrowers) are
kept apart. Neither measures belonging. Distances are not travel times.
"""
from __future__ import annotations

import glob
import hashlib
import io
import json
import math
import os
import sys
import tempfile
import zipfile
from collections import defaultdict
from pathlib import Path

import duckdb
import requests

ROOT = Path(__file__).resolve().parents[3]
RAW = Path(os.environ.get("PORTFOLIO_RAW", ROOT / "warehouse/raw"))
DATABASE = Path(os.environ.get("PORTFOLIO_DB", ROOT / "warehouse/portfolio.duckdb"))
PUBLISHED_PANEL = "https://pub-9867b18896ba49e4a0b4a3d2f39c0385.r2.dev/parquet/welfare/mart_municipality_year_panel.parquet"
OUT = ROOT / "frontend/public/data/sweden/belonging"
TERMS = {"BemanService01": "service_points", "Besok01": "visits", "Publ199": "activities",
         "Aktiv99": "active_borrowers"}
PUBLIC = {"Folkbibliotek", "Folk- och skolbibliotek"}


def population() -> tuple[dict[tuple[str, int], float], str]:
    sql = "select municipality_code, year, population from {} where population is not null"
    if DATABASE.exists():
        con = duckdb.connect(str(DATABASE), read_only=True)
        rows = con.sql(sql.format("gold.mart_municipality_year_panel")).fetchall()
        source = "gold.mart_municipality_year_panel"
    else:
        payload = requests.get(PUBLISHED_PANEL, timeout=120).content
        with tempfile.NamedTemporaryFile(suffix=".parquet", delete=False) as tmp:
            tmp.write(payload)
        rows = duckdb.sql(sql.format(f"read_parquet('{Path(tmp.name).as_posix()}')")).fetchall()
        os.unlink(tmp.name)
        source = f"{PUBLISHED_PANEL} sha256:{hashlib.sha256(payload).hexdigest()}"
    return {(c, int(y)): p for c, y, p in rows}, source


def areas_and_projection() -> dict[str, float]:
    with tempfile.TemporaryDirectory() as tmp:
        with zipfile.ZipFile(RAW / "geography/scb_boundaries_shape.zip") as outer:
            inner = zipfile.ZipFile(io.BytesIO(outer.read("Kommun_Sweref99TM.zip")))
            inner.extractall(tmp)
        con = duckdb.connect()
        con.sql("install spatial; load spatial")
        shp = next(Path(tmp).rglob("Kommun_Sweref99TM.shp")).as_posix()
        return dict(con.sql(f"select KnKod, st_area(geom) / 1e6 from st_read('{shp}')").fetchall())


def to_sweref(points: list[tuple[float, float]]) -> list[tuple[float, float]]:
    con = duckdb.connect()
    con.sql("install spatial; load spatial")
    con.sql("create table p (i integer, lon double, lat double)")
    con.executemany("insert into p values (?, ?, ?)", [(i, lon, lat) for i, (lon, lat) in enumerate(points)])
    rows = con.sql("""select i, st_x(g), st_y(g) from (
                        select i, st_transform(st_point(lon, lat), 'EPSG:4326', 'EPSG:3006', always_xy := true) as g
                        from p) order by i""").fetchall()
    return [(x, y) for _, x, y in rows]


def main() -> int:
    libraries = [x for p in sorted(glob.glob(str(RAW / "kb/libraries-*.json")))
                 for x in json.loads(Path(p).read_text(encoding="utf-8"))["libraries"]]
    municipality_of = {x["sigel"]: x.get("municipality_code") for x in libraries}
    pop, pop_source = population()
    area = areas_and_projection()
    cells: dict = defaultdict(dict)
    left_out = defaultdict(int)
    for term, measure in TERMS.items():
        data = json.loads((RAW / f"kb/statistics/{term}.json").read_text(encoding="utf-8"))
        for o in data["observations"]:
            if o.get("targetGroup") not in PUBLIC:
                continue
            sigel = o["library"]["@id"].rsplit("/", 1)[-1]
            code = municipality_of.get(sigel)
            value = o.get(term)
            if not code or code not in area:
                left_out["no municipality in Biblioteksdatabasen"] += 1
                continue
            if not isinstance(value, (int, float)):
                left_out["no value"] += 1
                continue
            cell = cells[(code, int(o["sampleYear"]))]
            cell[measure] = cell.get(measure, 0) + value
    rows = []
    for (code, year), m in sorted(cells.items()):
        p = pop.get((code, year)) or pop.get((code, year - 1))
        row = {"code": code, "year": year, **{k: m.get(k) for k in TERMS.values()}, "population": p}
        if p:
            for k, per in (("service_points", 10_000), ("visits", 1), ("activities", 1_000),
                           ("active_borrowers", 100)):
                row[f"{k}_rate"] = round(m[k] * per / p, 4) if m.get(k) is not None else None
        row["km2_per_service_point"] = (round(area[code] / m["service_points"], 1)
                                        if m.get("service_points") else None)
        rows.append(row)
    years = sorted({r["year"] for r in rows})
    public = [x for x in libraries if x.get("alive") and x.get("library_type") in ("folkbib", "folkskolbib")
              and x.get("country_code") == "se"]
    located = [x for x in public if x.get("latitude") and x.get("longitude")]
    xy = to_sweref([(x["longitude"], x["latitude"]) for x in located])
    points = [{"name": x["name"], "code": x.get("municipality_code"), "type": x["library_type"],
               "x": round(px / 100), "y": round(py / 100)} for x, (px, py) in zip(located, xy)]
    OUT.mkdir(parents=True, exist_ok=True)
    write = lambda name, payload: (OUT / name).write_text(  # noqa: E731
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    write("municipalities.json", {
        "years": years, "rows": rows, "area_km2": {c: round(a, 1) for c, a in area.items()},
        "rates": {"service_points_rate": "per 10,000 inhabitants", "visits_rate": "per inhabitant",
                  "activities_rate": "per 1,000 inhabitants", "active_borrowers_rate": "per 100 inhabitants"}})
    write("libraries.json", {"crs": "EPSG:3006", "unit": "100 m", "libraries": points})
    manifest = lambda rel: json.loads(next((r for r in (RAW / "kb/_manifest.jsonl").read_text(encoding="utf-8").splitlines()[::-1]
                                            if json.loads(r).get("path", "").endswith(rel)), "{}"))  # noqa: E731
    write("coverage.json", {
        "observations_left_out": dict(left_out),
        "municipalities_per_year": {y: sum(1 for r in rows if r["year"] == y) for y in years},
        "public_libraries_registered": len(public), "with_coordinates": len(located),
        "population_source": pop_source,
        "sources": [
            {"name": "KB, official library statistics (bibstat)", "url": "https://bibstat.kb.se/", "licence": "CC0 1.0",
             "terms": list(TERMS), "sha256": {t: manifest(f"statistics/{t}.json").get("sha256") for t in TERMS}},
            {"name": "KB, Biblioteksdatabasen", "url": "https://bibdb.libris.kb.se/",
             "licence": "open API; KB describes the data as freely available, no licence named"},
            {"name": "SCB, digital boundaries", "licence": "CC0 1.0"},
        ],
        "run_id": os.environ.get("GITHUB_RUN_ID"), "code_sha": os.environ.get("GITHUB_SHA"),
    })
    sys.path.insert(0, str(ROOT / "platform/publish/symbolic"))
    import export_symbolic

    export_symbolic.register([OUT / n for n in ("municipalities.json", "libraries.json", "coverage.json")])
    print(f"SWEDEN belonging: {len(rows)} municipality-years {years[0]}–{years[-1]}, "
          f"{len(points)} located public libraries -> {OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
