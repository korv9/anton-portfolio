"""Labour-market types of municipalities (clustering plan item 1).

    python platform/publish/clusters/labour_market.py

Reads gold.mart_job_ad_municipality_field (job_ads.py, then dbt): distinct ads per year, SCB
municipality and occupation field. Pooled over 2023-2025, a municipality with fewer than 900 ads
(300 a year) is left out and counted. Features: centred log-ratios of the field shares (0.5 added
to every count).
- K-means for k = 3-10, k by silhouette; the gap statistic's k is reported beside it.
- Spectral co-clustering on the location quotients (share over the national share), so fields
  are grouped with the municipalities; Ward as a cross-check; both as ARI with K-means.
- Bootstrap over municipalities, a feature-wise permutation null, the same fit on 2023 and on
  2025 alone (ARI on the municipalities in both), and AMI with SKR's municipality groups and the
  2024 similarity groups.
"""
from __future__ import annotations

import json

import duckdb
import numpy as np
import pandas as pd
from sklearn.cluster import AgglomerativeClustering, SpectralCoclustering
from sklearn.metrics import adjusted_rand_score

import stats

YEARS = (2023, 2024, 2025)
MIN_ADS = 300
SIMILARITY = stats.PUBLIC / "sweden/similarity/municipalities.json"


def clr(counts: np.ndarray) -> np.ndarray:
    logs = np.log(counts + 0.5)
    return logs - logs.mean(axis=1, keepdims=True)


def gap_k(x: np.ndarray, ks, references: int = 20, seed: int = stats.SEED) -> int:
    """Smallest k with gap(k) >= gap(k+1) - s(k+1) (Tibshirani et al.), uniform box reference."""
    rng = np.random.default_rng(seed)
    low, high = x.min(axis=0), x.max(axis=0)
    def log_w(d, k):
        labels = stats.kmeans(k)(d)
        return np.log(sum(((d[labels == c] - d[labels == c].mean(axis=0)) ** 2).sum() for c in range(k)))
    gaps, sds = {}, {}
    for k in ks:
        ref = [log_w(rng.uniform(low, high, x.shape), k) for _ in range(references)]
        gaps[k], sds[k] = np.mean(ref) - log_w(x, k), np.std(ref) * np.sqrt(1 + 1 / references)
    return next((k for k in list(ks)[:-1] if gaps[k] >= gaps[k + 1] - sds[k + 1]), list(ks)[-1])


def matrix(rows: pd.DataFrame, years, minimum: int) -> tuple[pd.DataFrame, int]:
    wide = rows[rows.year.isin(years)].pivot_table(index="municipality_code", columns="occupation_field",
                                                   values="ads", aggfunc="sum", fill_value=0)
    kept = wide[wide.sum(axis=1) >= minimum * len(years)]
    return kept, len(wide) - len(kept)


def main() -> None:
    with duckdb.connect(str(stats.DATABASE), read_only=True) as con:
        rows = con.sql("select year, municipality_code, municipality_name, occupation_field, ads "
                       "from gold.mart_job_ad_municipality_field").df()
        unmatched = con.sql("select municipality, ads from gold.mart_job_ad_unmatched_municipalities "
                            "order by ads desc").fetchall()
    names = dict(zip(rows.municipality_code, rows.municipality_name))
    wide, dropped = matrix(rows, YEARS, MIN_ADS)
    counts = wide.to_numpy(float)
    x = clr(counts)
    k, sweep = stats.choose_k(x, range(3, 11))
    fit = stats.kmeans(k)
    labels = fit(x)
    observed = stats.silhouette(x, labels)
    shares = counts / counts.sum(axis=1, keepdims=True)
    national = counts.sum(axis=0) / counts.sum()
    lq = shares / national
    co = SpectralCoclustering(k, random_state=42).fit(lq + 1e-9)
    ward = AgglomerativeClustering(k, linkage="ward").fit_predict(x)
    yearly = {}
    for year in (YEARS[0], YEARS[-1]):
        w, _ = matrix(rows, [year], MIN_ADS)
        yearly[year] = pd.Series(fit(clr(w.to_numpy(float))), index=w.index)
    common = yearly[YEARS[0]].index.intersection(yearly[YEARS[-1]].index)
    codes = wide.index.to_numpy()
    reference = {m["code"]: m for m in json.loads(SIMILARITY.read_text(encoding="utf-8"))["municipalities"]}
    refs = {"skr_group": [reference.get(c, {}).get("skr_group") for c in codes],
            "similarity_k4_2024": [reference.get(c, {}).get("finer") for c in codes]}
    diagnostics = stats.diagnostics(labels, observed, stats.bootstrap_ari(x, labels, fit),
                                    stats.permutation_null(x, observed, fit),
                                    {n: stats.ami(labels, r) for n, r in refs.items()},
                                    space="centred log-ratios of 21 occupation-field shares")
    fields = wide.columns.to_numpy()
    clusters = []
    for c in range(k):
        pooled = counts[labels == c].sum(axis=0)
        mean_lq = pooled / pooled.sum() / national  # the type's pooled location quotient
        top = np.argsort(-mean_lq)[:4]
        members = codes[labels == c]
        largest = sorted(members, key=lambda m: -counts[codes == m].sum())[:5]
        clusters.append({"id": c, "size": int(len(members)), "ads": int(counts[labels == c].sum()),
                         "top_fields": [[fields[i], round(float(mean_lq[i]), 3)] for i in top],
                         "largest": [names[m] for m in largest],
                         "share": dict(zip(fields, np.round(shares[labels == c].mean(axis=0), 4).tolist()))})
    metrics = {
        "title": "Labour-market types of municipalities",
        "method": {"features": "CLR of occupation-field shares of distinct ads (+0.5)", "years": list(YEARS),
                   "algorithm": "k-means", "k": k, "k_sweep_silhouette": sweep, "gap_k": gap_k(x, range(3, 11)),
                   "seed": 42, "min_ads_per_year": MIN_ADS},
        "diagnostics": diagnostics, "clusters": clusters,
        "coverage": {"municipalities": int(len(codes)), "dropped_below_minimum": int(dropped),
                     "unmatched_names": [[n, int(a)] for n, a in unmatched],
                     "note": "A null name is an ad with no municipality."},
        "cross_checks": {
            "ward_ari": round(float(adjusted_rand_score(labels, ward)), 4),
            "cocluster_ari": round(float(adjusted_rand_score(labels, co.row_labels_)), 4),
            "cocluster_fields": {int(c): fields[co.column_labels_ == c].tolist() for c in range(k)},
            "year_ari": {"years": [YEARS[0], YEARS[-1]], "municipalities": int(len(common)),
                         "ari": round(float(adjusted_rand_score(yearly[YEARS[0]][common], yearly[YEARS[-1]][common])), 4)}},
        "assignments": ["labour-market-types", "labour-market-cocluster"], "members": True, "shares": False,
    }
    period = f"{YEARS[0]}-{YEARS[-1]}"
    assignments = pd.concat([stats.frame("labour-market-types", codes, [names[c] for c in codes], period, labels),
                             stats.frame("labour-market-cocluster", codes, [names[c] for c in codes], period,
                                         co.row_labels_)])
    stats.save("labour-market-types", wide.reset_index(), assignments, metrics)


if __name__ == "__main__":
    main()
