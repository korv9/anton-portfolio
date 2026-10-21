"""Publish SWEDEN D, The Infrastructure of Belonging: public libraries as places to take part
without buying anything, per municipality, from KB's official library statistics.

    python platform/publish/sweden/export_belonging.py

Inputs: gold.fct_library_municipality_year (KB's library statistics, bibstat, CC0: staffed service
points, physical visits, public activities and active borrowers per municipality and year, with the
municipal population), gold.fct_library_observation (what was left out), gold.dim_library (KB's
Biblioteksdatabasen: the public libraries' coordinates); SCB's boundaries for each municipality's
land area.

Writes frontend/public/data/sweden/belonging/:
- `municipalities.json`: per municipality and year, the four measures and their rates per
  inhabitant; and land area.
- `libraries.json`: public libraries in Biblioteksdatabasen with coordinates in SWEREF99 TM
  (100 m), name and municipality. No contact details.
- `coverage.json`: what was joined, what was left out and why, the values set to missing, and how
  many municipalities report each measure in every year.

The dbt models (platform/models/gold/sweden) sum the organisations per municipality: a total is
missing when one of its reporting organisations omitted the term that year, since the sum would be
partial, and zero visits with a staffed service point, or zero service points with visits, are
treated as missing values, not as zeros.

Availability (service points, opening) and participation (visits, activities, borrowers) are
kept apart. Neither measures belonging. Distances are not travel times.
"""
from __future__ import annotations

import io
import json
import os
import sys
import tempfile
import zipfile
from collections import Counter
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parents[3]
RAW = Path(os.environ.get("PORTFOLIO_RAW", ROOT / "warehouse/raw"))
DATABASE = Path(os.environ.get("PORTFOLIO_DB", ROOT / "warehouse/portfolio.duckdb"))
OUT = ROOT / "frontend/public/data/sweden/belonging"
TERMS = {"BemanService01": "service_points", "Besok01": "visits", "Publ199": "activities",
         "Aktiv99": "active_borrowers"}


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


def coverage_counts(con) -> tuple[dict, dict]:
    """The observations left out (no current municipality, no value) and the values gold set to
    missing, by reason."""
    no_code, no_value = con.sql("""select count(*) filter (where municipality_code is null),
                                          count(*) filter (where municipality_code is not null and value is null)
                                   from gold.fct_library_observation""").fetchone()
    left_out = {k: n for k, n in (("no municipality in Biblioteksdatabasen", no_code), ("no value", no_value)) if n}
    missing = Counter(r for (reasons,) in con.sql("""select set_to_missing from gold.fct_library_municipality_year
                                                     order by municipality_code, year""").fetchall() for r in reasons)
    return left_out, dict(missing)


def main() -> int:
    con = duckdb.connect(str(DATABASE), read_only=True)
    measures = list(TERMS.values())
    totals = con.sql(f"""select municipality_code, year, population, {', '.join(measures)}
                         from gold.fct_library_municipality_year""").fetchall()
    cells = {(code, year): dict(zip(measures, m)) for code, year, _, *m in totals}
    pop = {(code, year): p for code, year, p, *_ in totals}
    left_out, missing = coverage_counts(con)
    area = areas_and_projection()
    rows = []
    for (code, year), m in sorted(cells.items()):
        p = pop[(code, year)]
        row = {"code": code, "year": year, **m, "population": p}
        if p:
            for k, per in (("service_points", 10_000), ("visits", 1), ("activities", 1_000),
                           ("active_borrowers", 100)):
                row[f"{k}_rate"] = round(m[k] * per / p, 4) if m.get(k) is not None else None
        row["km2_per_service_point"] = (round(area[code] / m["service_points"], 1)
                                        if m.get("service_points") else None)
        rows.append(row)
    years = sorted({r["year"] for r in rows})
    public = con.sql("""select name, municipality_code, library_type, longitude, latitude from gold.dim_library
                        where alive and library_type in ('folkbib', 'folkskolbib') and country_code = 'se'
                        order by dump_order""").fetchall()
    located = [x for x in public if x[4] and x[3]]
    xy = to_sweref([(lon, lat) for _, _, _, lon, lat in located])
    points = [{"name": name, "code": code, "type": kind, "x": round(px / 100), "y": round(py / 100)}
              for (name, code, kind, _, _), (px, py) in zip(located, xy)]
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
        "set_to_missing": dict(missing),
        "municipalities_reporting_every_year": {
            k: sum(1 for c in area if all(m.get(k) is not None for m in (cells.get((c, y), {}) for y in years)))
            for k in TERMS.values()},
        "public_libraries_registered": len(public), "with_coordinates": len(located),
        "population_source": "gold.mart_municipality_year_panel",
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
