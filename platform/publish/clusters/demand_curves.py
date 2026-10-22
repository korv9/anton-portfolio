"""Occupation demand-curve shapes (clustering plan item 2).

    python platform/publish/clusters/demand_curves.py

Reads gold.mart_job_ad_occupation_month: distinct ads per month and occupation group,
2023-01 to 2026-09 (45 months); groups with at least 2,000 ads. Each group's log share of all ads
that month (so a curve is relative to the market, which fell after 2023) is split
into a trend (centred 2x12 moving average, 33 months) and a seasonal profile (mean deviation from
the trend per calendar month), and each part is z-normalised, so only its shape counts. The two
parts are clustered separately: average linkage on correlation distance, k by silhouette over
3-8, K-means on the z-scores as a check (tslearn is not installed, so no k-Shape).
- bootstrap over occupations, and a block bootstrap over months (the remainder after trend and
  season resampled in 12-month blocks, then both parts rebuilt and refitted);
- nulls: each trend's months shuffled; each seasonal profile shifted by a random number of months
  (circular), which keeps its shape and breaks its timing.
"""
from __future__ import annotations

import duckdb
import numpy as np
import pandas as pd
from sklearn.cluster import AgglomerativeClustering
from sklearn.metrics import adjusted_rand_score

import stats

FIRST, LAST = "2023-01", "2026-09"
MIN_ADS = 2000
BLOCK = 12


def znorm(x: np.ndarray) -> np.ndarray:
    return (x - x.mean(axis=1, keepdims=True)) / np.maximum(x.std(axis=1, keepdims=True), 1e-9)


def decompose(y: np.ndarray, first_month: int) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Trend (2x12 MA), seasonal profile by calendar month (centred) and the remainder."""
    kernel = np.r_[0.5, np.ones(11), 0.5] / 12
    trend = np.stack([np.convolve(row, kernel, mode="valid") for row in y])
    detrended = y[:, 6:-6] - trend
    months = (np.arange(6, y.shape[1] - 6) + first_month) % 12
    season = np.stack([detrended[:, months == m].mean(axis=1) for m in range(12)], axis=1)
    season -= season.mean(axis=1, keepdims=True)
    return trend, season, detrended - season[:, months]


def correlation_fit(k: int):
    def fit(x: np.ndarray) -> np.ndarray:
        distance = 1 - np.corrcoef(x)
        return AgglomerativeClustering(k, metric="precomputed", linkage="average").fit_predict(np.clip(distance, 0, 2))
    return fit


def correlation_silhouette(x: np.ndarray, labels: np.ndarray) -> float | None:
    return stats.silhouette(np.clip(1 - np.corrcoef(x), 0, 2), labels, "precomputed")


def block_bootstrap(y, first_month, part, labels, fit, rounds=100, seed=stats.SEED) -> dict:
    trend, season, rest = decompose(y, first_month)
    months = (np.arange(6, y.shape[1] - 6) + first_month) % 12
    rng = np.random.default_rng(seed)
    scores = []
    for _ in range(rounds):
        starts = rng.integers(0, rest.shape[1] - BLOCK + 1, -(-rest.shape[1] // BLOCK))
        drawn = np.concatenate([rest[:, s:s + BLOCK] for s in starts], axis=1)[:, :rest.shape[1]]
        rebuilt = trend + season[:, months] + drawn
        padded = np.concatenate([y[:, :6], rebuilt, y[:, -6:]], axis=1)
        new_trend, new_season, _ = decompose(padded, first_month)
        scores.append(adjusted_rand_score(labels, fit(znorm(new_trend if part == "trend" else new_season))))
    return stats.summary(scores, rounds, seed, f"remainder resampled in {BLOCK}-month blocks, both parts rebuilt")


def shift_season(x: np.ndarray, rng) -> np.ndarray:
    return np.stack([np.roll(row, rng.integers(0, 12)) for row in x])


def shuffle_months(x: np.ndarray, rng) -> np.ndarray:
    return np.stack([rng.permutation(row) for row in x])


def cluster_part(x, y, first_month, part, shuffle, kind) -> tuple[np.ndarray, dict, dict]:
    sweep = {k: correlation_silhouette(x, correlation_fit(k)(x)) for k in range(3, 9)}
    k = max(sweep, key=lambda k: sweep[k] or -1)
    fit = correlation_fit(k)
    labels = fit(x)
    observed = correlation_silhouette(x, labels)
    null = stats.permutation_null(x, observed, fit, shuffle=shuffle, kind=kind, score=correlation_silhouette)
    diagnostics = stats.diagnostics(labels, observed, stats.bootstrap_ari(x, labels, fit), null,
                                    space=f"z-normalised {part}, correlation distance")
    diagnostics["block_bootstrap_ari"] = block_bootstrap(y, first_month, part, labels, fit)
    check = stats.kmeans(k)(x)
    return labels, diagnostics, {"k": k, "k_sweep_silhouette": sweep,
                                 "kmeans_ari": round(float(adjusted_rand_score(labels, check)), 4)}


def bands(x: np.ndarray, labels: np.ndarray) -> list[dict]:
    out = []
    for c in sorted(set(labels)):
        rows = x[labels == c]
        medoid = int(np.argmin((1 - np.corrcoef(rows)).sum(axis=1))) if len(rows) > 1 else 0
        out.append({"id": int(c), "size": int(len(rows)), "medoid": np.round(rows[medoid], 3).tolist(),
                    "p10": np.round(np.percentile(rows, 10, axis=0), 3).tolist(),
                    "p90": np.round(np.percentile(rows, 90, axis=0), 3).tolist()})
    return out


def main() -> None:
    with duckdb.connect(str(stats.DATABASE), read_only=True) as con:
        rows = con.sql(f"""select month, occupation_group, occupation_field, ads from gold.mart_job_ad_occupation_month
                           where month between '{FIRST}' and '{LAST}'""").df()
    wide = rows.pivot_table(index="occupation_group", columns="month", values="ads", aggfunc="sum", fill_value=0)
    wide = wide[wide.sum(axis=1) >= MIN_ADS].sort_index(axis=1)
    fields = rows.drop_duplicates("occupation_group").set_index("occupation_group").occupation_field
    # Each group's share of all ads that month: the market-wide fall since 2023 and the common
    # summer dip would otherwise be the shape of almost every curve.
    total = rows.groupby("month").ads.sum().reindex(wide.columns).to_numpy(float)
    y = np.log((wide.to_numpy(float) + 1) / total)
    first_month = int(FIRST[5:]) - 1
    trend, season, _ = decompose(y, first_month)
    xt, xs = znorm(trend), znorm(season)
    trend_labels, trend_diag, trend_method = cluster_part(xt, y, first_month, "trend", shuffle_months,
                                                          "each trend's months shuffled")
    season_labels, season_diag, season_method = cluster_part(xs, y, first_month, "seasonal profile", shift_season,
                                                             "each seasonal profile shifted circularly")
    groups = wide.index.to_numpy()
    growth = (trend[:, -1] - trend[:, 0])
    metrics = {
        "title": "Occupation demand-curve shapes",
        "method": {"months": [FIRST, LAST], "min_ads": MIN_ADS, "features": "log share of the month's ads; 2x12 MA trend and "
                   "calendar-month seasonal profile, each z-normalised", "algorithm": "average linkage, correlation distance",
                   "trend": trend_method, "season": season_method,
                   "trend_months": list(wide.columns[6:-6])},
        "diagnostics": trend_diag, "season_diagnostics": season_diag,
        "clusters": bands(xt, trend_labels), "season_clusters": bands(xs, season_labels),
        "curves": {"columns": ["occupation_group", "field", "ads", "trend_log_change", "trend", "season"],
                   "rows": [[g, fields.get(g), int(wide.loc[g].sum()), round(float(d), 3), np.round(t, 2).tolist(),
                             np.round(s, 2).tolist()] for g, d, t, s in zip(groups, growth, xt, xs)]},
        "assignments": ["demand-trend", "demand-season"], "members": True, "shares": False,
    }
    period = f"{FIRST}..{LAST}"
    names = [fields.get(g) for g in groups]
    assignments = pd.concat([stats.frame("demand-trend", groups, names, period, trend_labels),
                             stats.frame("demand-season", groups, names, period, season_labels)])
    stats.save("demand-curves", wide.reset_index().rename(columns=str), assignments, metrics)


if __name__ == "__main__":
    main()
