"""Publish the dooh subject, "När kommer publiken fram?": the public-transport audience at
Stockholm's metro stations as a digital out-of-home media owner would read it.

    python platform/publish/dooh/export_dooh.py

Inputs: gold.dim_dooh_station, fct_dooh_station_year, fct_dooh_station_halfhour,
fct_dooh_rail_stop and fct_dooh_deso_year; seeds.dooh_planned_stations and
seeds.dooh_opening_forecasts (hand-compiled, a source URL per row); SCB's DeSO 2025 and retail
area layers in warehouse/raw/scb_deso.

Writes frontend/public/data/dooh/:
- `stations.json`: boardings per station and edition 2013–2022, change 2013→2019 and 2019→2022.
- `dayparts.json`: the hourly audience index per station (2019 bands, today's departures), and
  morning and afternoon shares of shopping and other locations.
- `new-stations.json`: prediction 1, boardings at the planned stations with 80 % intervals, the
  pre-registered check and its label; and prediction 3 (`at_opening`), the same stations'
  residents and boardings in their branch's likely opening year (reach.py).
- `timing.json`: prediction 2, every official forecast per branch and the opening-year range.
- `about.json`: sources, method, departures from the pre-registration and limits.

The method is fixed in docs/research/preregistrations/outdoor-preregistration.md and
dooh-future-reach-preregistration.md (prediction 3, Region Stockholm's planning-area projection
in gold.fct_dooh_planning_area_year and seeds.dooh_planning_areas).
"""
from __future__ import annotations

import math
import sys
from datetime import date
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import catchment  # noqa: E402
import dayparts  # noqa: E402
import predict  # noqa: E402
import reach  # noqa: E402

from portfolio.core import db  # noqa: E402
from portfolio.core.config import DATABASE, PUBLIC, RAW, ROOT  # noqa: E402
from portfolio.core.io import write_json  # noqa: E402
from portfolio.publish.catalog import register  # noqa: E402

OUT = PUBLIC / "dooh"
TRAIN_YEAR, SENSITIVITY_YEAR, DAYPART_YEAR = 2022, 2019, 2019
MIN_KM = 0.25
FEATURES = ("log_residents", "log_employed", "log1p_retail_employees", "log_km_to_centre",
            "interchange_routes", "terminal")


def rows(con, sql: str) -> list[dict]:
    result = con.sql(sql)
    return [dict(zip(result.columns, r)) for r in result.fetchall()]


def design(f: dict, terminal: bool) -> list[float]:
    return [1.0, math.log(f["residents"]), math.log(f["employed"]), math.log1p(f["retail_employees"]),
            math.log(max(f["km_to_centre"], MIN_KM)), float(f["interchange_routes"]), float(terminal)]


def deso_values(con, year: int) -> tuple[str, dict[str, tuple], dict[str, int]]:
    """Residents and employed residents of `year`: for each, the latest year SCB has published
    up to `year`, or its first year when it begins later (employed residents begin in 2020).
    Returns the DeSO division, deso_code -> (residents, employed), and the years used."""
    used, versions, out = {}, set(), {}
    for column in ("residents", "employed"):
        have = [y for (y,) in con.sql(f"select distinct year from gold.fct_dooh_deso_year where {column} is not null order by 1").fetchall()]
        use = max((y for y in have if y <= year), default=min(have))
        used[column] = use
        for version, code, value in con.sql(f"select deso_version, deso_code, {column} from gold.fct_dooh_deso_year where year = {use}").fetchall():
            versions.add(version)
            out.setdefault(code, [None, None])[column == "employed"] = value
    if len(versions) != 1:
        raise ValueError(f"residents and employed residents of {year} are on different DeSO divisions: {versions}")
    return versions.pop(), {k: tuple(v) for k, v in out.items()}, used


def station_features(con, geo, points: dict, year: int) -> tuple[dict, dict]:
    version, values, used = deso_values(con, year)
    rail = {r["station_id"]: (r["longitude"], r["latitude"], r["route_ids"])
            for r in rows(con, "select * from gold.fct_dooh_rail_stop")}
    centre = next((lon, lat) for k, (lon, lat) in points.items() if k == "tcentralen")
    return catchment.features(geo, points, version, values, rail, centre), used | {"deso": int(version)}


def audience(con, stations: list[dict]) -> dict:
    years = [r["year"] for r in rows(con, "select distinct year from gold.fct_dooh_station_year order by 1")]
    data = rows(con, "select * from gold.fct_dooh_station_year order by station_key, year")
    totals = {y: sum(r["boardings"] for r in data if r["year"] == y) for y in years}
    by = {(r["station_key"], r["year"]): r["boardings"] for r in data}
    out = []
    for s in stations:
        k = s["station_key"]
        series = [by[(k, y)] for y in years]
        out.append({**s, "boardings": series,
                    "share": [round(by[(k, y)] / totals[y], 5) for y in years],
                    "change_2013_2019": round(math.log(by[(k, 2019)] / by[(k, 2013)]), 4),
                    "change_2019_2022": round(math.log(by[(k, 2022)] / by[(k, 2019)]), 4)})
    sources = rows(con, "select distinct year, read_from, source_url, original_url, source_sha256 from gold.fct_dooh_station_year order by year")
    return {"years": years, "totals": [totals[y] for y in years], "stations": out, "editions": sources,
            "unit": "boardings per average winter weekday, counted by hand"}


def daypart_view(con, stations: list[dict], shopping: dict[str, bool]) -> dict:
    bands = {r["station_key"]: r for r in rows(con, f"select * from gold.fct_dooh_station_year where year = {DAYPART_YEAR}")}
    deps: dict[str, dict[int, int]] = {}
    for r in rows(con, "select * from gold.fct_dooh_station_halfhour"):
        deps.setdefault(r["station_key"], {})[r["half_hour"]] = r["departures"]
    service_date = con.sql("select any_value(service_date) from gold.fct_dooh_station_halfhour").fetchone()[0]
    hourly = {}
    for s in stations:
        b = bands[s["station_key"]]
        counts = {"day": b["boardings"], **{k: b[k] for k in ("h06_09", "h0730_0830", "h15_18", "h1630_1730")}}
        hourly[s["station_key"]] = dayparts.hours(dayparts.halfhours(counts, deps[s["station_key"]]))
    indexed, mean = dayparts.index(hourly)
    groups = {}
    for label, flag in (("shopping", True), ("other", False)):
        keys = [k for k in hourly if shopping[k] == flag]
        am = [bands[k]["h06_09"] / bands[k]["boardings"] for k in keys]
        pm = [bands[k]["h15_18"] / bands[k]["boardings"] for k in keys]
        groups[label] = {"stations": len(keys), "morning_share_median": round(float(np.median(am)), 4),
                         "afternoon_share_median": round(float(np.median(pm)), 4),
                         "index_mean": [round(float(np.mean([indexed[k].get(h, 0) for k in keys])), 1) for h in range(24)],
                         # The shape of the day apart from its size: each station's hour as a share
                         # of its day, averaged over the group's stations.
                         "share_mean": [round(float(np.mean([hourly[k].get(h, 0) / bands[k]["boardings"] for k in keys])), 5)
                                        for h in range(24)]}
    return {"year": DAYPART_YEAR, "service_date": str(service_date), "mean_hourly_boardings": round(mean, 1),
            "stations": [{"station_key": s["station_key"], "shopping": shopping[s["station_key"]],
                          "morning_share": round(bands[s["station_key"]]["h06_09"] / bands[s["station_key"]]["boardings"], 4),
                          "afternoon_share": round(bands[s["station_key"]]["h15_18"] / bands[s["station_key"]]["boardings"], 4),
                          "index": [round(indexed[s["station_key"]].get(h, 0), 1) for h in range(24)],
                          "boardings": [round(hourly[s["station_key"]].get(h, 0)) for h in range(24)]}
                         for s in stations],
            "groups": groups}


def new_inventory(con, geo, stations: list[dict], target: dict, planned: list[dict]) -> dict:
    points = {s["station_key"]: (s["longitude"], s["latitude"]) for s in stations}
    results = {}
    for year in (TRAIN_YEAR, SENSITIVITY_YEAR):
        feats, used = station_features(con, geo, points, year)
        X = np.array([design(feats[s["station_key"]], s["terminal"]) for s in stations])
        y = np.array([math.log(target[(s["station_key"], year)]) for s in stations])
        results[year] = (X, y, feats, used)
    X, y, feats, used = results[TRAIN_YEAR]
    new = [p for p in planned if p["kind"] == "new"]
    latest = 9999  # deso_values takes the latest year SCB has published
    pfeats, pused = station_features(con, geo, {**points, **{p["station"]: (p["longitude"], p["latitude"]) for p in new}}, latest)
    fitted = predict.loo(X, y)
    beta = predict.fit(X, y)
    out = []
    for p in planned:
        row = {k: p[k] for k in ("station", "branch", "kind", "latitude", "longitude", "terminal", "source_url")}
        if p["kind"] == "new":
            f = pfeats[p["station"]]
            point, lo, hi = predict.jackknife_plus(X, y, np.array(design(f, p["terminal"])), fitted=fitted)
            row |= {"features": {k: round(float(v), 3) for k, v in f.items()},
                    "boardings": round(math.exp(point), -2), "interval80": [round(math.exp(lo), -2), round(math.exp(hi), -2)]}
        out.append(row)
    sens_X, sens_y = results[SENSITIVITY_YEAR][:2]
    return {"target_year": TRAIN_YEAR, "deso_years": {"training": used, "planned": pused},
            "features": list(FEATURES), "coefficients": [round(float(b), 4) for b in beta],
            "check": predict.check(X, y), "sensitivity_2019": predict.check(sens_X, sens_y),
            "sensitivity_2019_deso_years": results[SENSITIVITY_YEAR][3],
            "stations": out,
            "existing": [{"station_key": s["station_key"], "observed": target[(s["station_key"], TRAIN_YEAR)],
                          "fitted": round(math.exp(float(X[i] @ beta)), -2),
                          "loo": round(math.exp(float(X[i] @ fitted[0][i])), -2)} for i, s in enumerate(stations)],
            "shopping": {k: bool(v["shopping"]) for k, v in feats.items()},
            "_fit": (X, y, fitted), "_planned_features": pfeats}


def timing(con, now: date) -> dict:
    # A forecast counts when it gives a year for the whole branch: the 2014 date for Hagastaden
    # alone is a different milestone, and a statement without a year ("not set", a time after
    # project start) moves nothing. Those rows are published apart, as `undated`.
    every = rows(con, "select * from seeds.dooh_opening_forecasts order by branch, statement_date")
    forecasts = [f for f in every if f["scope"] == "branch" and f["opening_year"] is not None]
    branches = sorted({f["branch"] for f in forecasts})
    series = {b: [(predict.decimal_date(f["statement_date"]),
                   predict.opening_point(f["opening_year"], f["opening_quarter"], f["opening_month"]))
                  for f in forecasts if f["branch"] == b] for b in branches}
    pool = [i for b in branches for i in predict.intervals(series[b])]
    t_now = predict.decimal_date(now)
    out = []
    for b in branches:
        rng = predict.SEED + branches.index(b)
        latest = max(series[b])[1]
        own = predict.intervals(series[b])
        out.append({"branch": b, "latest_forecast": round(latest, 2), "revisions": len(own),
                    "range": predict.opening(latest, t_now, pool, np.random.default_rng(rng)),
                    "own_branch": predict.opening(latest, t_now, own, np.random.default_rng(rng)) if len(own) >= 2 else None,
                    "forecasts": [{k: (str(v) if isinstance(v, date) else v) for k, v in f.items()}
                                  for f in forecasts if f["branch"] == b]})
    undated = [{k: (str(v) if isinstance(v, date) else v) for k, v in f.items()} for f in every if f not in forecasts]
    return {"now": str(now), "seed": predict.SEED, "resamples": predict.RESAMPLES, "branches": out,
            "undated": undated}


def future(con, planned: list[dict], pfeats: dict, opening: dict, fit) -> dict:
    """Prediction 3: the new stations' audience in their branch's likely opening year."""
    links: dict[str, list[str]] = {}
    for station, area in con.sql("select station, split_part(planning_area, ' ', 1) from seeds.dooh_planning_areas order by 1, 2").fetchall():
        links.setdefault(station, []).append(area)
    projection: dict[str, dict[int, float]] = {}
    for code, year, residents in con.sql("select planning_area_code, year, residents from gold.fct_dooh_planning_area_year").fetchall():
        projection.setdefault(code, {})[year] = residents
    branches = {b["branch"]: b for b in opening["branches"]}
    new = [p for p in planned if p["kind"] == "new"]
    return {"preregistration": "docs/research/preregistrations/dooh-future-reach-preregistration.md",
            "projection": "Region Stockholm, Befolkningsprognos 2026, data för planområden",
            "base_year": reach.BASE_YEAR, "last_year": reach.LAST_YEAR,
            "stations": reach.at_opening(new, pfeats, links, projection, branches, design, fit)}


def main() -> int:
    con = db.warehouse(DATABASE)
    stations = rows(con, "select * from gold.dim_dooh_station order by station_name")
    target = {(r["station_key"], r["year"]): r["boardings"]
              for r in rows(con, "select station_key, year, boardings from gold.fct_dooh_station_year")}
    planned = rows(con, "select * from seeds.dooh_planned_stations order by branch, station")
    checked = con.sql("select max(checked_on) from seeds.dooh_opening_forecasts").fetchone()[0]
    geo = catchment.connect({v: RAW / f"scb_deso/deso_{v}.geojson" for v in ("2018", "2025")},
                            RAW / "scb_deso/retail_2020.geojson")
    inventory = new_inventory(con, geo, stations, target, planned)
    shopping = inventory.pop("shopping")
    fit, pfeats = inventory.pop("_fit"), inventory.pop("_planned_features")
    opening = timing(con, checked)
    inventory["at_opening"] = future(con, planned, pfeats, opening, fit)
    write = lambda name, payload: write_json(OUT / name, payload)  # noqa: E731
    write("stations.json", audience(con, [{**s, "shopping": shopping[s["station_key"]]} for s in stations]))
    write("dayparts.json", daypart_view(con, stations, shopping))
    write("new-stations.json", inventory)
    write("timing.json", opening)
    write("about.json", about(con))
    register([OUT / n for n in ("stations.json", "dayparts.json", "new-stations.json", "timing.json", "about.json")])
    print(f"dooh: {len(stations)} stations, {len(planned)} planned, label {inventory['check']['label']} "
          f"-> {OUT.relative_to(ROOT)}")
    return 0


def about(con) -> dict:
    feed = con.sql("select any_value(service_date) from gold.fct_dooh_station_halfhour").fetchone()[0]
    return {
        "preregistration": "docs/research/preregistrations/outdoor-preregistration.md",
        "gtfs_service_date": str(feed),
        "departures": [f"Distance to T-Centralen enters as log(max(km, {MIN_KM})): T-Centralen's own distance is 0, whose log the pre-registration did not define.",
                       "SCB publishes 2022 and 2019 on the DeSO 2018 division only, so training uses DeSO 2018 boundaries and figures; the planned stations use DeSO 2025, the latest (deso_years).",
                       "Employed residents begin in 2020, so the 2019 sensitivity fit uses 2020's (deso_years in sensitivity_2019_deso_years).",
                       "The 2014 forecast for Hagastaden alone, and statements without a year, are not revisions of a branch's opening and are published as `undated` in timing.json."],
        "limits": ["boardings_not_people", "no_price_or_revenue", "winter_weekday_only", "series_ends_2022",
                   "pandemic_2020_2021", "dayparts_shape_modelled", "employed_by_residence",
                   "growth_by_planning_area", "jobs_as_today", "no_ramp_up"],
    }


if __name__ == "__main__":
    raise SystemExit(main())
