"""Shared statistics and storage for the cluster exports (batches 0-2 of the clustering plan).

Every clustering here reports the same checks, so a post can show one "how sure" tile:
- `silhouette` in the space the clustering was fitted in, never a 2D map (cluster_lab's).
- `bootstrap_ari`: rows drawn with replacement, refitted, compared with the reference labels on
  the drawn rows (ml.research.regions, one round at a time); mean and 5-95 % range.
- `permutation_null`: the same fit on data with each feature permuted on its own (or any other
  shuffle passed as `shuffle`), against the observed silhouette; one-sided p with the +1 rule.
  mlkit's permutation_test shuffles labels against fixed predictions, so it does not fit here.
- `k_flags`: a k picked at an end of the sweep, or with a runner-up within NEAR_TIE.
- `diagnostics` assembles the block. A mean ARI under MIN_ARI, or the same fit on two periods
  agreeing under MIN_ARI, marks the export as a counter-example; under MIN_N units it is
  descriptive. Neither is a finding.

`save` writes features/clusters/<name>/{inputs.parquet, run/assignments.parquet,
run/metrics.json} atomically and records the run in the cluster_lab registry (one SQLite ledger
per warehouse, cluster_lab/clusters/registry.sqlite); the run id is a digest of the inputs, the
metrics and the assignments, so an unchanged rerun keeps its id. NaN stops the save.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.cluster.hierarchy import fcluster, linkage
from sklearn.cluster import KMeans
from sklearn.metrics import adjusted_mutual_info_score

from portfolio.core.config import CLUSTER_LAB, DATABASE, PUBLIC, ROOT
from portfolio.core.config import FEATURES as FEATURE_ROOT
sys.path.insert(0, str(ROOT))
from ml.cluster_lab.evaluate import silhouette as lab_silhouette  # noqa: E402
from ml.cluster_lab.io import atomic_json, atomic_parquet, digest  # noqa: E402
from ml.cluster_lab.registry import Registry  # noqa: E402
from ml.research.regions import bootstrap_ari as region_bootstrap_ari  # noqa: E402

SEED = 20261022
MIN_ARI = 0.6
MIN_N = 50
NEAR_TIE = 0.005
KS = range(2, 9)
FEATURES = FEATURE_ROOT / "clusters"
LAB = CLUSTER_LAB / "clusters"
ASSIGNMENT_COLUMNS = ["clustering", "entity_id", "entity_name", "period", "cluster", "probability"]


def kmeans(k: int, seed: int = 42, n_init: int = 10):
    return lambda x: KMeans(k, n_init=n_init, random_state=seed).fit_predict(x)


def ward(x: np.ndarray, k: int) -> np.ndarray:
    return fcluster(linkage(x, "ward"), k, "maxclust") - 1


def clr(values: np.ndarray) -> np.ndarray:
    """Centred log-ratios of positive parts (add any pseudocount before)."""
    logs = np.log(values)
    return logs - logs.mean(axis=1, keepdims=True)


def silhouette(x: np.ndarray, labels: np.ndarray, metric: str = "euclidean") -> float | None:
    labels = np.asarray(labels)
    if metric == "precomputed":  # cluster_lab drops noise rows only, not their columns
        keep = labels >= 0
        x, labels = x[np.ix_(keep, keep)], labels[keep]
    value = lab_silhouette(x, labels, metric)["value"]
    return None if value is None else round(value, 4)


def choose_k(x: np.ndarray, ks=KS, fit=kmeans, metric: str = "euclidean") -> tuple[int, dict]:
    """k with the highest silhouette in the fitted space, and the whole sweep."""
    sweep = {k: silhouette(x, fit(k)(x), metric) for k in ks}
    return max(sweep, key=lambda k: sweep[k] if sweep[k] is not None else -1), sweep


def k_flags(sweep: dict, k: int) -> list[str]:
    """Why a silhouette pick may be weak: at an end of the sweep, or a runner-up within NEAR_TIE."""
    flags = [f"k = {k} is at the end of the sweep {min(sweep)}-{max(sweep)}"] if k in (min(sweep), max(sweep)) else []
    others = {j: v for j, v in sweep.items() if j != k and v is not None}
    if others and sweep[k] is not None:
        runner = max(others, key=others.get)
        if sweep[k] - others[runner] < NEAR_TIE:
            flags.append(f"k = {runner} is within {NEAR_TIE} of k = {k} ({others[runner]} vs {sweep[k]})")
    return flags


def summary(values, rounds: int, seed: int, method: str) -> dict:
    values = np.asarray(values, dtype=float)
    return {"mean": round(float(values.mean()), 4), "p05": round(float(np.percentile(values, 5)), 4),
            "p95": round(float(np.percentile(values, 95)), 4), "rounds": rounds, "seed": seed, "method": method}


def bootstrap_ari(x: np.ndarray, labels: np.ndarray, fit, rounds: int = 100, seed: int = SEED,
                  method: str = "rows drawn with replacement, refitted, compared on the drawn rows") -> dict:
    rng = np.random.default_rng(seed)
    refit = lambda d: np.asarray(fit(d))
    return summary([region_bootstrap_ari(refit, x, np.asarray(labels), rng, 1) for _ in range(rounds)],
                   rounds, seed, method)


def column_shuffle(x: np.ndarray, rng) -> np.ndarray:
    return np.column_stack([rng.permutation(x[:, j]) for j in range(x.shape[1])])


def permutation_null(x: np.ndarray, observed: float, fit, rounds: int = 200, seed: int = SEED,
                     shuffle=column_shuffle, kind: str = "each feature permuted on its own",
                     score=None) -> dict:
    """Silhouette (or `score(x, labels)`) of the same fit on shuffled data; p is the share at
    least as high as observed."""
    score = score or silhouette
    rng = np.random.default_rng(seed)
    null = []
    for _ in range(rounds):
        drawn = shuffle(x, rng)
        null.append(score(drawn, np.asarray(fit(drawn))) or 0.0)
    null = np.asarray(null)
    return {"statistic": "silhouette", "kind": kind, "observed": observed,
            "null_median": round(float(np.median(null)), 4), "null_95": round(float(np.percentile(null, 95)), 4),
            "p": round((1 + int((null >= observed).sum())) / (1 + rounds), 4), "rounds": rounds, "seed": seed}


def ami(labels, reference) -> float | None:
    keep = [i for i, r in enumerate(reference) if r is not None and labels[i] >= 0]
    if len(keep) < 2:
        return None
    return round(float(adjusted_mutual_info_score([reference[i] for i in keep], [labels[i] for i in keep])), 4)


def diagnostics(labels: np.ndarray, silhouette_value, stability: dict | None, null: dict | None,
                reference: dict | None = None, space: str = "", note: str = "", sweep: dict | None = None,
                period_ari: dict | None = None, stability_key: str = "bootstrap_ari") -> dict:
    """The "how sure" block. `reference` maps a known label set to its AMI with the clusters;
    `period_ari` is {"periods": ..., "ari": ...} for the same fit on two periods alone."""
    labels = np.asarray(labels)
    ari = (stability or {}).get("mean")
    drift = (period_ari or {}).get("ari")
    status = ("unvalidated" if ari is None else
              "counter_example" if ari < MIN_ARI or (drift is not None and drift < MIN_ARI) else
              "descriptive" if len(labels) < MIN_N else "finding")
    k = int(len(set(labels[labels >= 0])))
    return {"n": int(len(labels)), "k": k,
            "noise_share": round(float((labels < 0).mean()), 4),
            "largest_share": round(float(np.bincount(labels[labels >= 0]).max() / len(labels)), 4) if (labels >= 0).any() else None,
            "silhouette_original": silhouette_value, "silhouette_space": space,
            stability_key: stability, "null": null, "ami_reference": reference or {},
            **({"period_ari": period_ari} if period_ari else {}),
            **({"k_flags": k_flags(sweep, k)} if sweep else {}),
            "status": status, "min_ari": MIN_ARI, "min_n": MIN_N, **({"note": note} if note else {})}


def save(name: str, inputs: pd.DataFrame, assignments: pd.DataFrame, metrics: dict,
         shares: pd.DataFrame | None = None) -> str:
    """Write the features and register the run; returns the run id, also written into metrics."""
    missing = set(ASSIGNMENT_COLUMNS) - set(assignments.columns)
    if missing:
        raise ValueError(f"{name}: assignments lack {sorted(missing)}")
    assignments = assignments[ASSIGNMENT_COLUMNS]
    # Plain JSON types; allow_nan=False makes a NaN anywhere in the metrics stop the run here.
    metrics = json.loads(json.dumps({**metrics, "name": name}, allow_nan=False, default=lambda v: v.tolist()))
    run_id = digest([inputs.to_csv(index=False), metrics, assignments.to_csv(index=False)])[:24]
    metrics["run_id"] = run_id
    folder = FEATURES / name
    atomic_parquet(inputs, folder / "inputs.parquet")
    atomic_parquet(assignments, folder / "run/assignments.parquet")
    if shares is not None:
        atomic_parquet(shares if "clustering" in shares else shares.assign(clustering=name), folder / "run/shares.parquet")
    atomic_json(folder / "run/metrics.json", metrics)
    registry = Registry(LAB)
    try:
        with registry.writer():
            registry.put(run_id, "run", "completed", {"name": name, "folder": str(folder / "run"),
                                                      "method": metrics.get("method"),
                                                      "diagnostics": metrics.get("diagnostics")})
    finally:
        registry.close()
    print(f"{name}: run {run_id}, {metrics.get('diagnostics', {}).get('status')}")
    return run_id


def frame(clustering: str, ids, names, period, labels, probability=None) -> pd.DataFrame:
    return pd.DataFrame({"clustering": clustering, "entity_id": [str(i) for i in ids],
                         "entity_name": [str(n) for n in names], "period": str(period) if np.isscalar(period) else
                         [str(p) for p in period], "cluster": np.asarray(labels, dtype=int),
                         "probability": np.nan if probability is None else probability})
