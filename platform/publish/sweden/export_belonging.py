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
- `change.json`: visits and service points before and after 2019 (balanced panel, all paired
  municipalities, and with the repaired zeros restored), recovery ratios by SKR group with
  bootstrap intervals, a two-way fixed-effects slope of log visits on service points with
  county-clustered errors, and the cross-sectional supply-use correlation with log population
  partialled out. Seed and resamples are in its `method` block.

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
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from connections_stats import cluster_sample, partial, spearman  # noqa: E402

from portfolio.core import db
from portfolio.core.io import write_json  # this module uses the standard io
from portfolio.core.config import DATABASE, PUBLIC, RAW, ROOT
from portfolio.publish.catalog import register
OUT = PUBLIC / "sweden/belonging"
TERMS = {"BemanService01": "service_points", "Besok01": "visits", "Publ199": "activities",
         "Aktiv99": "active_borrowers"}
SEED = 20261021
RESAMPLES = 2000
# 2019 is the last year before the pandemic closed libraries.
PERIODS = ((2014, 2019), (2019, 2025))
ZEROS = {"visits": "visits: 0 with staffed service points", "service_points": "service_points: 0 with visits"}


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
    no_code, no_value = con.execute("""select count(*) filter (where municipality_code is null),
                                          count(*) filter (where municipality_code is not null and value is null)
                                   from gold.fct_library_observation""").fetchone()
    left_out = {k: n for k, n in (("no municipality in Biblioteksdatabasen", no_code), ("no value", no_value)) if n}
    missing = Counter(r for (reasons,) in con.sql("""select set_to_missing from gold.fct_library_municipality_year
                                                     order by municipality_code, year""").fetchall() for r in reasons)
    return left_out, dict(missing)


def total_change(cell: dict, codes, a: int, z: int, k: str) -> dict:
    """The sum of k at both ends over the codes reporting k in both years."""
    both = [c for c in codes if cell.get((c, a), {}).get(k) is not None and cell.get((c, z), {}).get(k) is not None]
    f, t = sum(cell[(c, a)][k] for c in both), sum(cell[(c, z)][k] for c in both)
    return {"n": len(both), "from": f, "to": t, "change_pct": round((t / f - 1) * 100, 1) if f else None}


def median_ci(x: np.ndarray, rng) -> dict:
    draws = np.median(x[rng.integers(0, len(x), (RESAMPLES, len(x)))], axis=1)
    return {"n": len(x), "median": round(float(np.median(x)), 3),
            "ci95": [round(float(np.percentile(draws, q)), 3) for q in (2.5, 97.5)]}


def within_slope(cell: dict, codes: list[str], years: list[int], rng) -> dict:
    """Two-way fixed effects: log visits on service points with municipality and year effects, on
    the municipalities with both measures (visits above 0) in every year. CR1 standard error and a
    percentile bootstrap that resamples counties (the first two digits of the code)."""
    keep = sorted(c for c in codes if all((cell.get((c, y)) or {}).get("visits") and
                                           cell[(c, y)].get("service_points") is not None for y in years))
    x = np.array([[cell[(c, y)]["service_points"] for y in years] for c in keep], float)
    v = np.log([[cell[(c, y)]["visits"] for y in years] for c in keep])
    county = np.array([c[:2] for c in keep])

    def fit(rows):
        xs, ys = x[rows], v[rows]
        dm = lambda m: m - m.mean(1, keepdims=True) - m.mean(0) + m.mean()  # noqa: E731
        xd, yd = dm(xs), dm(ys)
        b = float((xd * yd).sum() / (xd ** 2).sum())
        return b, xd, yd - b * xd

    beta, xd, e = fit(np.arange(len(keep)))
    groups = sorted(set(county))
    score = np.array([(xd[county == g] * e[county == g]).sum() for g in groups])
    n, g, k = xd.size, len(groups), 1 + len(keep) + len(years) - 1
    se = float(np.sqrt((score ** 2).sum() * g / (g - 1) * (n - 1) / (n - k)) / (xd ** 2).sum())
    draws = [fit(cluster_sample(county, rng))[0] for _ in range(RESAMPLES)]
    return {"years": [years[0], years[-1]], "municipalities": len(keep), "counties": g,
            "log_visits_per_service_point": round(beta, 4), "se_county_cluster": round(se, 4),
            "ci95_county_bootstrap": [round(float(np.percentile(draws, q)), 4) for q in (2.5, 97.5)]}


def change(rows: list[dict], reasons: dict, skr: dict[str, str], years: list[int]) -> dict:
    """SWEDEN D before and after 2019. rows carry code, year, service_points, visits and the rates
    with population; reasons maps (code, year) to gold's set_to_missing list."""
    rng = np.random.default_rng(SEED)
    cell = {(r["code"], r["year"]): r for r in rows}
    restored = {key: r | {m: 0 for m, why in ZEROS.items() if why in reasons.get(key, ())} for key, r in cell.items()}
    codes = sorted({c for c, _ in cell})
    every = {k: [c for c in codes if all(cell.get((c, y), {}).get(k) is not None for y in years)]
             for k in ("visits", "service_points")}
    periods = [{"from": a, "to": z, **{k: {"balanced": total_change(cell, every[k], a, z, k),
                                           "paired": total_change(cell, codes, a, z, k),
                                           "zeros_restored": total_change(restored, codes, a, z, k)}
                                       for k in ("visits", "service_points")}} for a, z in PERIODS]
    # Did losing a service point before 2020 go with a larger fall in visits?
    a, z = PERIODS[0]
    both = [c for c in codes if all((cell.get((c, y)) or {}).get("visits") and
                                    cell[(c, y)].get("service_points") is not None for y in (a, z))]
    dsp = np.array([cell[(c, z)]["service_points"] - cell[(c, a)]["service_points"] for c in both])
    dlv = np.array([np.log(cell[(c, z)]["visits"] / cell[(c, a)]["visits"]) for c in both])
    lost = {"years": [a, z], "n": len(both), "lost_a_point": int((dsp < 0).sum()),
            "median_visit_change_pct": {"lost": round(float(np.expm1(np.median(dlv[dsp < 0]))) * 100, 1),
                                        "rest": round(float(np.expm1(np.median(dlv[dsp >= 0]))) * 100, 1)},
            "rho_points_change_log_visits_change": round(spearman(dsp, dlv), 3)}
    recovery = []
    for a, z in PERIODS:
        ratio = {c: cell[(c, z)]["visits"] / cell[(c, a)]["visits"] for c in codes
                 if (cell.get((c, a)) or {}).get("visits") and (cell.get((c, z)) or {}).get("visits")}
        recovery.append({"from": a, "to": z, "all": median_ci(np.array(list(ratio.values())), rng), "groups": {
            g: median_ci(np.array([r for c, r in ratio.items() if skr.get(c) == g]), rng) for g in sorted(set(skr.values()))}})
    supply = {}
    for y in (PERIODS[0][1], years[-1]):
        p = [r for r in rows if r["year"] == y and r.get("service_points_rate") is not None
             and r.get("visits_rate") is not None]
        sp, vr = np.array([r["service_points_rate"] for r in p]), np.array([r["visits_rate"] for r in p])
        supply[y] = {"n": len(p), "rho": round(spearman(sp, vr), 3),
                     "partial_rho_log_population": round(partial(sp, vr, [np.log([r["population"] for r in p])]), 3)}
    return {
        "balanced_visits": {"municipalities": len(every["visits"]),
                            "totals": {y: sum(cell[(c, y)]["visits"] for c in every["visits"]) for y in years}},
        "periods": periods, "lost_service_point": lost, "recovery": recovery,
        "within": [within_slope(cell, codes, list(range(a, z + 1)), rng) for a, z in ((years[0], years[-1]), PERIODS[0])],
        "supply_use": supply,
        "method": {"seed": SEED, "resamples": RESAMPLES, "groups": "SKR's 2023 municipality groups (gold.fct_municipal_similarity)",
                   "interval": "percentile bootstrap of the median; the slope resamples counties",
                   "zeros_restored": "visits or service points that gold set to missing because they were 0, counted as 0"},
    }


def main() -> int:
    con = db.warehouse(DATABASE)
    measures = list(TERMS.values())
    totals = con.sql(f"""select municipality_code, year, set_to_missing, population, {', '.join(measures)}
                         from gold.fct_library_municipality_year""").fetchall()
    cells = {(code, year): dict(zip(measures, m)) for code, year, _, _, *m in totals}
    pop = {(code, year): p for code, year, _, p, *_ in totals}
    reasons = {(code, year): why for code, year, why, *_ in totals}
    skr = dict(con.sql("""select municipality_code, skr_group from gold.fct_municipal_similarity
                           where skr_group is not null""").fetchall())
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
    write = lambda name, payload: write_json(OUT / name, payload)  # noqa: E731
    write("municipalities.json", {
        "years": years, "rows": rows, "area_km2": {c: round(a, 1) for c, a in area.items()},
        "rates": {"service_points_rate": "per 10,000 inhabitants", "visits_rate": "per inhabitant",
                  "activities_rate": "per 1,000 inhabitants", "active_borrowers_rate": "per 100 inhabitants"}})
    write("change.json", change(rows, reasons, skr, years))
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
    register([OUT / n for n in ("municipalities.json", "libraries.json", "coverage.json", "change.json")])
    print(f"SWEDEN belonging: {len(rows)} municipality-years {years[0]}–{years[-1]}, "
          f"{len(points)} located public libraries -> {OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
