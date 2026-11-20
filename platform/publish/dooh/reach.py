"""Prediction 3 (docs/research/preregistrations/dooh-future-reach-preregistration.md): the
audience around each new planned station in the year its branch is likely to open.

The residents and employed residents within 1,000 m grow with the station's planning area(s) in
Region Stockholm's projection; prediction 1's fitted model, not refitted, gives the boardings.
"""
from __future__ import annotations

import math

import numpy as np

import predict

BASE_YEAR, LAST_YEAR = 2025, 2035


def opening_year(value: float | None) -> tuple[int, bool]:
    """A decimal opening year as a whole year, capped at the projection's last year; None (the
    median falls after 2060) is capped too. Returns the year and whether it was capped."""
    if value is None or math.floor(value) > LAST_YEAR:
        return LAST_YEAR, True
    return max(math.floor(value), BASE_YEAR), False


def growth(projection: dict[str, dict[int, float]], areas: list[str], year: int) -> float:
    """Projected residents of the station's planning areas in `year` over the same in 2025."""
    return sum(projection[a][year] for a in areas) / sum(projection[a][BASE_YEAR] for a in areas)


def scenario(features: dict, terminal: bool, g: float, design, X, y, fitted) -> dict:
    grown = {**features, "residents": features["residents"] * g, "employed": features["employed"] * g}
    point, lo, hi = predict.jackknife_plus(X, y, np.array(design(grown, terminal)), fitted=fitted)
    return {"growth": round(g, 4), "reach": round(grown["residents"], -2),
            "employed_residents": round(grown["employed"], -2),
            "boardings": round(math.exp(point), -2), "interval80": [round(math.exp(lo), -2), round(math.exp(hi), -2)]}


def at_opening(stations: list[dict], features: dict, links: dict[str, list[str]],
               projection: dict[str, dict[int, float]], branches: dict[str, dict], design, fit) -> list[dict]:
    """Per new station: the opening year used, its audience today and at opening, and the
    pre-stated sensitivity with the latest official forecast as the opening year."""
    X, y, fitted = fit
    out = []
    for s in stations:
        f, branch = features[s["station"]], branches[s["branch"]]
        today = scenario(f, s["terminal"], 1.0, design, X, y, fitted)
        row = {"station": s["station"], "branch": s["branch"], "planning_areas": links[s["station"]],
               "today": today}
        for name, value in (("median", branch["range"]["p50"]), ("official", branch["latest_forecast"])):
            year, capped = opening_year(value)
            g = growth(projection, links[s["station"]], year)
            row[name] = {"year": year, "capped": capped,
                         **scenario(f, s["terminal"], g, design, X, y, fitted)}
        out.append(row)
    return out


def demo() -> None:
    assert opening_year(2031.51) == (2031, False)
    assert opening_year(2051.3) == (2035, True) and opening_year(None) == (2035, True)
    projection = {"a": {2025: 100.0, 2030: 150.0}, "b": {2025: 100.0, 2030: 50.0}}
    assert growth(projection, ["a"], 2030) == 1.5 and growth(projection, ["a", "b"], 2030) == 1.0
    # With residents and employed in the model, growth moves the prediction by the sum of their
    # coefficients times log g.
    rng = np.random.default_rng(1)
    X = np.column_stack([np.ones(40), rng.normal(size=40), rng.normal(size=40)])
    y = X @ np.array([1.0, 0.6, 0.4]) + rng.normal(scale=0.05, size=40)
    design = lambda f, t: [1.0, math.log(f["residents"]), math.log(f["employed"])]  # noqa: E731
    fit = (X, y, predict.loo(X, y))
    base = scenario({"residents": 1e4, "employed": 1e4}, False, 1.0, design, *fit)
    grown = scenario({"residents": 1e4, "employed": 1e4}, False, math.e, design, *fit)
    assert grown["boardings"] > base["boardings"]


if __name__ == "__main__":
    demo()
    print("reach: demo passed")
