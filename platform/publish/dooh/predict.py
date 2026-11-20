"""The dooh subject's two pre-registered predictions
(docs/research/preregistrations/outdoor-preregistration.md).

1. `boardings`: ordinary least squares on log boardings with an 80 % jackknife+ interval, its
   leave-one-out check against the median, and the decision rule's label.
2. `opening`: the bootstrapped slip rate of the official opening forecasts and the opening year
   it implies per branch.
"""
from __future__ import annotations

import math
from datetime import date

import numpy as np

SEED = 20261119
ALPHA = 0.2
RESAMPLES = 10_000
HORIZON = 2060.0


def fit(X: np.ndarray, y: np.ndarray) -> np.ndarray:
    return np.linalg.lstsq(X, y, rcond=None)[0]


def loo(X: np.ndarray, y: np.ndarray) -> tuple[list[np.ndarray], np.ndarray]:
    """The n leave-one-out coefficient vectors and residuals |y_i − ŷ_{−i}(x_i)|."""
    betas = [fit(np.delete(X, i, 0), np.delete(y, i)) for i in range(len(y))]
    return betas, np.abs(y - np.array([X[i] @ b for i, b in enumerate(betas)]))


def jackknife_plus(X: np.ndarray, y: np.ndarray, x_new: np.ndarray, alpha: float = ALPHA,
                   fitted: tuple | None = None) -> tuple[float, float, float]:
    """Point prediction (full fit) and the jackknife+ interval (Barber et al. 2021) at x_new."""
    betas, residuals = fitted or loo(X, y)
    centre = np.array([x_new @ b for b in betas])
    n = len(y)
    lower = np.sort(centre - residuals)[max(math.floor(alpha * (n + 1)) - 1, 0)]
    upper = np.sort(centre + residuals)[min(math.ceil((1 - alpha) * (n + 1)) - 1, n - 1)]
    return float(x_new @ fit(X, y)), float(lower), float(upper)


def check(X: np.ndarray, y: np.ndarray, alpha: float = ALPHA) -> dict:
    """The pre-stated check: leave-one-out median absolute error of the model and of the median
    of the other stations, and the coverage of each station's interval computed without it."""
    n = len(y)
    betas, residuals = loo(X, y)
    null = np.abs(y - np.array([np.median(np.delete(y, i)) for i in range(n)]))
    inside = 0
    for i in range(n):
        Xi, yi = np.delete(X, i, 0), np.delete(y, i)
        _, lo, hi = jackknife_plus(Xi, yi, X[i], alpha)
        inside += lo <= y[i] <= hi
    model_mae, null_mae = float(np.median(residuals)), float(np.median(null))
    coverage = inside / n
    label = "model" if model_mae <= 0.75 * null_mae and 0.70 <= coverage <= 0.90 else "not_better_than_median"
    return {"n": n, "loo_median_abs_log_error": round(model_mae, 4),
            "null_median_abs_log_error": round(null_mae, 4),
            "improvement": round(1 - model_mae / null_mae, 4), "coverage": round(coverage, 4),
            "label": label}


def decimal_date(value: date) -> float:
    start = date(value.year, 1, 1)
    return value.year + (value - start).days / (date(value.year + 1, 1, 1) - start).days


def opening_point(year: int, quarter: int | None = None, month: int | None = None) -> float:
    """A forecast as a decimal year: the middle of its month, quarter or year."""
    if month:
        return year + (month - 0.5) / 12
    if quarter:
        return year + (quarter - 0.5) / 4
    return year + 0.5


def intervals(forecasts: list[tuple[float, float]]) -> list[tuple[float, float]]:
    """(elapsed years, change of forecast in years) between consecutive statements of one branch;
    forecasts are (statement, opening) as decimal years. Statements on the same day are one."""
    rows = sorted(forecasts)
    return [(t2 - t1, f2 - f1) for (t1, f1), (t2, f2) in zip(rows, rows[1:]) if t2 > t1]


def opening(latest: float, now: float, pool: list[tuple[float, float]], rng) -> dict:
    """Opening year percentiles if the latest forecast keeps slipping at a bootstrapped rate."""
    elapsed = np.array([e for e, _ in pool])
    change = np.array([c for _, c in pool])
    picks = rng.integers(0, len(pool), (RESAMPLES, len(pool)))
    rho = change[picks].sum(axis=1) / elapsed[picks].sum(axis=1)
    remaining = latest - now
    with np.errstate(divide="ignore"):
        years = np.where(rho < 1, now + remaining / (1 - rho), np.inf)
    late = years > HORIZON
    # A percentile that falls among the draws after 2060 is published as None ("after 2060").
    capped = np.where(late, HORIZON + 1, years)
    pct = {f"p{q}": (None if (v := float(np.percentile(capped, q))) > HORIZON else round(v, 2))
           for q in (10, 50, 90)}
    return {**pct, "after_2060": round(float(late.mean()), 4), "rho_median": round(float(np.median(rho)), 4),
            "intervals": len(pool)}


def demo() -> None:
    rng = np.random.default_rng(SEED)
    X = np.column_stack([np.ones(60), rng.normal(size=60)])
    y = X @ np.array([1.0, 2.0]) + rng.normal(scale=0.1, size=60)
    point, lo, hi = jackknife_plus(X, y, np.array([1.0, 0.0]))
    assert lo < point < hi and abs(point - 1.0) < 0.1
    assert check(X, y)["label"] == "model"
    # A forecast that never moves opens on time; one that slips a year per two years doubles.
    steady = opening(2030.0, 2026.0, [(1.0, 0.0), (2.0, 0.0)], rng)
    assert steady["p50"] == 2030.0
    slipping = opening(2030.0, 2026.0, [(2.0, 1.0), (2.0, 1.0)], rng)
    assert slipping["p50"] == 2034.0
    assert intervals([(2020.0, 2025.5), (2018.0, 2024.5)]) == [(2.0, 1.0)]


if __name__ == "__main__":
    demo()
    print("predict: demo passed")
