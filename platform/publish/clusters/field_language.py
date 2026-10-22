"""Language profiles of occupation fields (clustering plan item 13): a descriptive tree of 21 fields.

    python platform/publish/clusters/field_language.py

sweden/language/fields.json (SWEDEN B): distinct ad texts and texts matching each of the nine
lexicon categories, per occupation field and year. Each field's profile is its log rate ratio to
all fields per category, pooled over 2010-2025, standardised per category. Ward, cut at 2-6 groups
by silhouette.
- bootstrap over fields; null with each category permuted over fields;
- the same fit on 2010-2016 and on 2019-2025 separately, and the ARI between them;
- categories ordered by average linkage on their correlation, for a heatmap.
"""
from __future__ import annotations

import json

import numpy as np
import pandas as pd
from scipy.cluster.hierarchy import fcluster, leaves_list, linkage
from sklearn.metrics import adjusted_rand_score

import stats

FIELDS = stats.PUBLIC / "sweden/language/fields.json"
YEARS = range(2010, 2026)
EARLY, LATE = range(2010, 2017), range(2019, 2026)


def profile(rows: pd.DataFrame, years) -> pd.DataFrame:
    cell = rows[rows.year.isin(years)].groupby(["field", "category"])[["texts", "texts_matching"]].sum()
    rate = (cell.texts_matching / cell.texts).unstack()
    overall = cell.groupby("category").sum()
    ratio = np.log(rate.clip(lower=1e-6) / (overall.texts_matching / overall.texts))
    return (ratio - ratio.mean()) / ratio.std()


def ward(x: np.ndarray, k: int) -> np.ndarray:
    return fcluster(linkage(x, "ward"), k, "maxclust") - 1


def main() -> None:
    data = json.loads(FIELDS.read_text(encoding="utf-8"))
    rows = pd.DataFrame(data["rows"], columns=data["columns"])
    every = set(rows.field)
    complete = rows[rows.year.isin(YEARS)].groupby("field").year.nunique()
    rows = rows[rows.field.isin(complete[complete == len(YEARS)].index)]
    z = profile(rows, YEARS)
    x = z.to_numpy()
    k, sweep = stats.choose_k(x, range(2, 7), fit=lambda k: lambda d: ward(d, k))
    fit = lambda d: ward(d, k)
    labels = fit(x)
    observed = stats.silhouette(x, labels)
    early, late = profile(rows, EARLY), profile(rows, LATE)
    order = leaves_list(linkage(x.T, "average", metric="correlation"))
    diagnostics = stats.diagnostics(
        labels, observed, stats.bootstrap_ari(x, labels, fit), stats.permutation_null(x, observed, fit), {},
        space="standardised log rate ratios per category",
        note=f"Descriptive: {len(x)} fields. Fields with a year missing in {YEARS[0]}-{YEARS[-1]} are left out.")
    clusters = [{"id": c, "size": int((labels == c).sum()), "members": z.index[labels == c].tolist(),
                 "profile": dict(zip(z.columns, np.round(x[labels == c].mean(axis=0), 3).tolist()))} for c in range(k)]
    metrics = {"title": "Language profiles of occupation fields",
               "method": {"features": "log rate ratio to all fields per category, standardised",
                          "years": [YEARS[0], YEARS[-1]], "algorithm": "Ward", "k": k, "k_sweep_silhouette": sweep},
               "diagnostics": diagnostics, "clusters": clusters,
               "periods": {"early": [EARLY[0], EARLY[-1]], "late": [LATE[0], LATE[-1]],
                           "ari_early_late": round(float(adjusted_rand_score(fit(early.to_numpy()), fit(late.to_numpy()))), 4)},
               "heatmap": {"fields": z.index.tolist(), "categories": z.columns[order].tolist(),
                           "rows": np.round(x[:, order], 3).tolist()},
               "excluded_fields": sorted(every - set(z.index)),
               "assignments": ["field-language"], "members": True, "shares": False}
    assignments = stats.frame("field-language", z.index, z.index, f"{YEARS[0]}-{YEARS[-1]}", labels)
    stats.save("field-language", z.reset_index(), assignments, metrics)


if __name__ == "__main__":
    main()
