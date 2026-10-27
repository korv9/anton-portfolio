"""Municipal trajectories 2010-2024 (clustering plan item 3).

    python platform/publish/clusters/trajectories.py

Reads features/sweden/similarity/mart_municipality_year_panel.parquet: 290 municipalities x 15
years x open unemployment 18-65, median earned income and the sick-pay rate, all complete
2010-2024. Each indicator is z-scored within its year (a municipality's position relative to
Sweden that year), then each municipality's 45 values form its trajectory.
- K-means on the flattened trajectories, k by silhouette over 2-8; bootstrap ARI; a null that
  shuffles each municipality's years (the shape over time destroyed, its levels kept). The
  clusters beat that null by little, so they are published as level groups, not shapes.
- The same k by average linkage on multivariate DTW distances; its ARI with K-means says how much
  of the grouping depends on timing being aligned.
- States for the flows: K-means on all municipality-years pooled, so each year has a type; each
  indicator permuted over the municipality-years as their null.
- AMI against the 2024 similarity groups (k = 2 and 4) and SKR's municipality groups.
"""
from __future__ import annotations

import json

import numpy as np
import pandas as pd
from sklearn.cluster import AgglomerativeClustering
from sklearn.metrics import adjusted_rand_score

import stats

PANEL = stats.FEATURES.parent / "sweden/similarity/mart_municipality_year_panel.parquet"
SIMILARITY = stats.PUBLIC / "sweden/similarity/municipalities.json"
INDICATORS = ["open_unemployment_18_65_pct", "median_earned_income_sek", "sick_pay_rate_1_days"]
YEARS = list(range(2010, 2025))
FLOW_YEARS = [2010, 2015, 2020, 2024]
CHUNK = 5000  # pairs per DTW block: about 30 MB for 15 years x 3 indicators
# Silhouette points above the null's 95th percentile a grouping needs to count as a finding.
MIN_MARGIN = 0.05


def dtw(series: np.ndarray, chunk: int = CHUNK) -> np.ndarray:
    """Pairwise multivariate DTW (Euclidean step cost) for series shaped (n, time, features)."""
    n, t, _ = series.shape
    left, right = np.triu_indices(n, 1)
    out = np.zeros((n, n))
    for start in range(0, len(left), chunk):
        a, b = left[start:start + chunk], right[start:start + chunk]
        step = np.linalg.norm(series[a][:, :, None, :] - series[b][:, None, :, :], axis=3)
        total = np.full((len(a), t + 1, t + 1), np.inf)
        total[:, 0, 0] = 0
        for i in range(1, t + 1):
            for j in range(1, t + 1):
                total[:, i, j] = step[:, i - 1, j - 1] + np.minimum(np.minimum(total[:, i - 1, j], total[:, i, j - 1]),
                                                                    total[:, i - 1, j - 1])
        out[a, b] = out[b, a] = total[:, t, t]
    return out


def shuffle_years(flat: np.ndarray, rng, years: int = len(YEARS)) -> np.ndarray:
    """Each municipality's years in a random order (the same order for its three indicators)."""
    series = flat.reshape(len(flat), years, -1)
    return np.stack([s[rng.permutation(years)] for s in series]).reshape(len(flat), -1)


def margin_status(status: str, margin: float) -> str:
    """A "finding" that beats the null by less than MIN_MARGIN is published as descriptive."""
    return "descriptive" if status == "finding" and margin < MIN_MARGIN else status


def main() -> None:
    panel = pd.read_parquet(PANEL)
    panel = panel[panel.year.isin(YEARS)]
    z = panel.copy()
    z[INDICATORS] = panel.groupby("year")[INDICATORS].transform(lambda c: (c - c.mean()) / c.std())
    cube = z.pivot_table(index="municipality_code", columns="year", values=INDICATORS)
    cube = cube.dropna()
    codes = cube.index.to_numpy()
    series = np.stack([cube[i].to_numpy() for i in INDICATORS], axis=2)  # (n, years, indicators)
    flat = series.reshape(len(series), -1)
    k, sweep = stats.choose_k(flat)
    fit = stats.kmeans(k)
    labels = fit(flat)
    observed = stats.silhouette(flat, labels)
    null = stats.permutation_null(flat, observed, fit, shuffle=shuffle_years,
                                  kind="years shuffled within each municipality")
    distance = dtw(series)
    dtw_labels = AgglomerativeClustering(k, metric="precomputed", linkage="average").fit_predict(distance)
    reference = json.loads(SIMILARITY.read_text(encoding="utf-8"))["municipalities"]
    by_code = {m["code"]: m for m in reference}
    refs = {name: [by_code.get(c, {}).get(key) for c in codes]
            for name, key in (("similarity_k2_2024", "group"), ("similarity_k4_2024", "finer"), ("skr_group", "skr_group"))}
    margin = round(observed - null["null_95"], 4)
    diagnostics = stats.diagnostics(labels, observed, stats.bootstrap_ari(flat, labels, fit), null,
                                    {n: stats.ami(labels, r) for n, r in refs.items()},
                                    space="45 within-year z-scores (3 indicators x 15 years), Euclidean", sweep=sweep,
                                    note=f"Level groups: the silhouette beats the null's 95th percentile by {margin}, and "
                                         "that null keeps each municipality's levels, so the groups are levels, not "
                                         "shapes over time.")
    diagnostics["status"] = margin_status(diagnostics["status"], margin)
    states = z.dropna(subset=INDICATORS)
    pooled = states[INDICATORS].to_numpy()
    ks, state_sweep = stats.choose_k(pooled)
    state_fit = stats.kmeans(ks)
    state_labels = state_fit(pooled)
    state_sil = stats.silhouette(pooled, state_labels)
    states = states.assign(cluster=state_labels)
    wide = states.pivot(index="municipality_code", columns="year", values="cluster")
    flows = [{"from_year": a, "to_year": b, "from": int(x), "to": int(y), "municipalities": int(n)}
             for a, b in zip(FLOW_YEARS, FLOW_YEARS[1:])
             for (x, y), n in wide.groupby([wide[a], wide[b]]).size().items()]
    raw = panel.set_index("municipality_code")
    clusters = []
    for c in range(k):
        members = codes[labels == c]
        cell = raw.loc[members]
        clusters.append({"id": c, "size": int(len(members)),
                         "mean_z": {i: np.round(series[labels == c, :, j].mean(axis=0), 3).tolist() for j, i in enumerate(INDICATORS)},
                         "mean_raw": {i: np.round(cell.groupby("year")[i].mean().to_numpy(), 2).tolist() for i in INDICATORS}})
    metrics = {
        "title": "Municipal level groups 2010-2024",
        "method": {"features": "within-year z-scores of " + ", ".join(INDICATORS), "years": [YEARS[0], YEARS[-1]],
                   "algorithm": "k-means on flattened trajectories", "k": k, "k_sweep_silhouette": sweep, "seed": 42},
        "diagnostics": diagnostics, "clusters": clusters,
        "dtw": {"algorithm": "average linkage on multivariate DTW", "k": k,
                "ari_with_kmeans": round(float(adjusted_rand_score(labels, dtw_labels)), 4),
                "silhouette_dtw": stats.silhouette(distance, dtw_labels, "precomputed")},
        "states": {"k": ks, "k_sweep_silhouette": state_sweep, "flows": flows, "flow_years": FLOW_YEARS,
                   "diagnostics": stats.diagnostics(state_labels, state_sil,
                                                    stats.bootstrap_ari(pooled, state_labels, state_fit),
                                                    stats.permutation_null(pooled, state_sil, state_fit),
                                                    space="3 within-year z-scores per municipality-year",
                                                    sweep=state_sweep),
                   "centres": {i: np.round([pooled[state_labels == c, j].mean() for c in range(ks)], 3).tolist()
                               for j, i in enumerate(INDICATORS)}},
        "assignments": ["municipal-trajectories", "municipal-states"], "members": True, "shares": False,
    }
    names = dict(zip(panel.municipality_code, panel.municipality_name))
    flow = states[states.year.isin(FLOW_YEARS)]  # the states are fitted on every year, published for the flows
    assignments = pd.concat([
        stats.frame("municipal-trajectories", codes, [names[c] for c in codes], f"{YEARS[0]}-{YEARS[-1]}", labels),
        stats.frame("municipal-states", flow.municipality_code, flow.municipality_name, flow.year, flow.cluster)])
    stats.save("municipal-trajectories", panel[["municipality_code", "year", *INDICATORS]].reset_index(drop=True),
               assignments, metrics)


if __name__ == "__main__":
    main()
