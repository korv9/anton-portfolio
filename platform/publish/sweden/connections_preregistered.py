"""SWEDEN Connections candidates 3.1 and 3.2, as pre-registered in
docs/sweden-connections-preregistration.md (committed in ecd242f2 before this code ran). Each
departure from that text is listed in DEVIATIONS and published with the result.

3.1 compares each municipality's library rates with the median of its five nearest social
neighbours in SWEDEN C, against neighbours drawn from the same SKR group. 3.2 regresses the log
change in library visits on the log changes in population and median earned income, within
municipalities, for 2014–2019 and 2019–2024.
"""
from __future__ import annotations

import math

import numpy as np

from connections_stats import RESAMPLES, cluster_sample, holm

SEED = 20261021
NEIGHBOURS = 5
MIN_NEIGHBOURS = 3
ROUNDS_31 = 999
ROUNDS_32 = 4999
WIDE = math.log(1.5)
PERIODS = ((2014, 2019), (2019, 2024))
RATES = {"visits": ("library_visits", 1), "service_points": ("library_service_points", 10_000)}
ORDER = ("not_supported", "uncertain", "robust")
DEVIATIONS = [
    ("3.1: Storstäder has three members, so none of them can be given five SKR peers. The three are left out of "
     "both the observed and the reference statistic, so the two cover the same municipalities."),
    "3.1: the pre-registration labels each measure. The card's own label is the weaker of the two.",
]


def rates(con, year: int) -> dict[str, dict[str, float]]:
    """D's rates per municipality in the year, rounded as D publishes them; a missing count stays missing."""
    rows = con.sql(f"""select municipality_code, library_population, {', '.join(c for c, _ in RATES.values())}
                       from gold.mart_municipality_year_cross_subject where year = {year}""").fetchall()
    out = {m: {} for m in RATES}
    for code, population, *counts in rows:
        for (m, (_, per)), count in zip(RATES.items(), counts):
            if population and count:
                out[m][code] = round(count * per / population, 4)
    return out


def neighbours(con, year: int, features: list[str]) -> tuple[list[dict], np.ndarray]:
    """C's analysed municipalities and their five nearest by the rule in export_similarity.py:
    Euclidean distance over the 12 indicators, each standardised over the analysed set."""
    cols = [f for f in features if f != "log_population"]
    rows = con.sql(f"""select municipality_code, municipality_name, skr_group, population, {', '.join(cols)}
                       from gold.fct_municipal_similarity where year = {year} and group_id is not null
                       order by municipality_code""").fetchall()
    raw = [dict(zip(cols, r[4:]), log_population=math.log(r[3])) for r in rows]
    matrix = np.array([[m[f] for f in features] for m in raw], dtype=float)
    z = (matrix - matrix.mean(axis=0)) / matrix.std(axis=0)
    distance = np.sqrt(((z[:, None, :] - z[None, :, :]) ** 2).sum(axis=2))
    nearest = np.array([[j for j in np.argsort(distance[i]) if j != i][:NEIGHBOURS] for i in range(len(rows))])
    return [{"code": r[0], "name": r[1], "skr": r[2]} for r in rows], nearest


def peer_median(own: np.ndarray, sets: np.ndarray) -> np.ndarray:
    """Median of each set's values; NaN without an own value or with under three values in the set."""
    peers, out = own[sets], np.full(len(own), np.nan)
    ok = ~np.isnan(own) & ((~np.isnan(peers)).sum(axis=1) >= MIN_NEIGHBOURS)
    out[ok] = np.nanmedian(peers[ok], axis=1)
    return out


def peer_sets(group: np.ndarray, eligible: np.ndarray, rng) -> np.ndarray:
    """Five others from each municipality's SKR group, without replacement."""
    sets = np.zeros((len(group), NEIGHBOURS), dtype=int)
    for g in np.unique(group[eligible]):
        members = np.flatnonzero(group == g)
        keys = rng.random((len(members), len(members)))
        np.fill_diagonal(keys, np.inf)
        sets[members] = members[np.argsort(keys, axis=1)[:, :NEIGHBOURS]]
    return sets


def matched(places: list[dict], nearest: np.ndarray, value: dict[str, float], points: bool = True) -> dict:
    group = np.array([p["skr"] for p in places])
    eligible = np.array([(group == g).sum() > NEIGHBOURS for g in group])
    own = np.array([value.get(p["code"], np.nan) for p in places])
    median = peer_median(own, nearest)
    ratio = np.log(own / median)
    keep = eligible & ~np.isnan(ratio)
    stat = float(np.median(np.abs(ratio[keep])))
    rng = np.random.default_rng(SEED)
    reference = []
    for _ in range(ROUNDS_31):
        r = np.abs(np.log(own / peer_median(own, peer_sets(group, eligible, rng))))
        reference.append(float(np.median(r[keep & ~np.isnan(r)])))
    low, mid = np.percentile(reference, [2.5, 50])
    out = {"n": int(keep.sum()), "median_abs_log_ratio": round(stat, 3),
           "share_beyond_1_5": round(float(np.mean(np.abs(ratio[keep]) > WIDE)), 3),
           "reference": {"rounds": ROUNDS_31, "seed": SEED, "median": round(float(mid), 3),
                         "interval_95": [round(float(v), 3) for v in np.percentile(reference, [2.5, 97.5])]},
           "p": round((1 + sum(r <= stat for r in reference)) / (1 + ROUNDS_31), 4),
           "assessment": "robust" if stat < low else "uncertain" if stat < mid else "not_supported"}
    if points:
        out["points"] = [[places[i]["code"], places[i]["name"], float(own[i]), round(float(median[i]), 4),
                          round(float(ratio[i]), 3)] for i in np.flatnonzero(keep)]
    return out


def neighbour_comparison(con, year: int, features: list[str], replication: int) -> dict:
    """Plan 3.1 as a published relationship."""
    places, nearest = neighbours(con, year, features)
    now, early = rates(con, year), rates(con, replication)
    measures = {m: matched(places, nearest, now[m]) for m in RATES}
    for m, p in zip(measures, holm([measures[m]["p"] for m in measures])):
        measures[m]["p_holm"] = round(p, 4)
    return {
        "id": "neighbours-libraries", "kind": "neighbours", "products": ["C", "D"],
        "question": "Among municipalities that C finds socially alike, how much do library use and supply differ?",
        "contract": {"geography": f"municipality, the {len(places)} that C analysed",
                     "time": f"neighbours from {year}; library rates {year}, repeated with {replication}",
                     "missing": "a municipality without its own rate or with under three neighbour rates is left out"},
        "confounders": ["tourism and second homes", "students", "commuting into a regional centre",
                        "door counters of uneven quality"],
        "result": {"measures": measures,
                   "sensitivity": {m: matched(places, nearest, early[m], points=False) | {"year": replication}
                                   for m in RATES}},
        "evidence": "descriptive",
        "assessment": min((measures[m]["assessment"] for m in RATES), key=ORDER.index),
        "alternatives": [("A municipality far above its neighbours may host a regional library, a university or a "
                          "tourist season, none of which C's 12 indicators cover.")],
    }


def ols(y: np.ndarray, x: np.ndarray) -> np.ndarray:
    return np.linalg.lstsq(np.column_stack([np.ones(len(y)), x]), y, rcond=None)[0][1:]


def change(con, balanced: bool = False) -> list[dict]:
    """Per period, least squares of Δ ln visits on Δ ln population and Δ ln median earned income."""
    first, last = PERIODS[0][0], PERIODS[-1][1]
    rows = con.sql(f"""select municipality_code, year, library_visits, population, median_earned_income_sek
                       from gold.mart_municipality_year_cross_subject where year between {first} and {last}""").fetchall()
    data = {(c, y): v for c, y, *v in rows}
    every_year = {c for c, _ in data if all((data.get((c, y)) or [None])[0] for y in range(first, last + 1))}
    out = []
    for start, end in PERIODS:
        codes = sorted(c for c, y in data if y == start and (c, end) in data
                       and all(v and v > 0 for v in data[(c, start)] + data[(c, end)])
                       and (not balanced or c in every_year))
        d = np.array([[math.log(data[(c, end)][k] / data[(c, start)][k]) for k in range(3)] for c in codes])
        y, x = d[:, 0], d[:, 1:]
        beta, county = ols(y, x), np.array([c[:2] for c in codes])
        rng = np.random.default_rng(SEED)
        boot = np.array([ols(y[i], x[i]) for i in (cluster_sample(county, rng) for _ in range(RESAMPLES))])
        rng = np.random.default_rng(SEED)
        perm = np.array([ols(rng.permutation(y), x) for _ in range(ROUNDS_32)])
        out.append({"period": [start, end], "n": len(codes), "coefficients": [
            {"predictor": name, "beta": round(float(b), 3),
             "ci95_county": [round(float(v), 3) for v in np.percentile(boot[:, k], [2.5, 97.5])],
             "p": round((1 + int((np.abs(perm[:, k]) >= abs(b)).sum())) / (1 + ROUNDS_32), 4)}
            for k, (name, b) in enumerate(zip(("population", "income"), beta))]})
    return out


def change_model(con) -> dict:
    """Plan 3.2 as a published relationship."""
    periods = change(con)
    coefficients = [c for p in periods for c in p["coefficients"]]
    for c, p in zip(coefficients, holm([c["p"] for c in coefficients])):
        c["p_holm"] = round(p, 4)
    sides = [[1 if c["ci95_county"][0] > 0 else -1 if c["ci95_county"][1] < 0 else 0 for c in p["coefficients"]]
             for p in periods]
    return {
        "id": "visits-change", "kind": "change", "products": ["D", "C"],
        "question": "Did library visits fall more in municipalities where population or income fell?",
        "contract": {"geography": "municipality (SCB code, 290)",
                     "time": " and ".join(f"{a}–{b}" for a, b in PERIODS),
                     "missing": "a municipality without visits, population or income at either end of a period is left out"},
        "confounders": ["library reorganisation and merged service points", "changed counting methods",
                        "the pandemic (hence two periods)"],
        "result": {"periods": periods, "balanced": change(con, balanced=True)},
        "evidence": "exploratory",
        "assessment": ("robust" if any(a == b != 0 for a, b in zip(*sides)) else
                       "not_supported" if not any(map(any, sides)) else "uncertain"),
        "alternatives": ["Shrinking municipalities may close branches first, so the ordering can run the other way."],
    }
