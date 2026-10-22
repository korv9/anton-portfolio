"""Shared statistics and storage for the cluster exports (batches 0-2 of the clustering plan).

Every clustering here reports the same checks, so a post can show one "how sure" tile:
- `silhouette` in the space the clustering was fitted in, never a 2D map.
- `bootstrap_ari`: rows drawn with replacement, refitted, compared with the reference labels on
  the drawn rows; mean and 5-95 % range.
- `permutation_null`: the same fit on data with each feature permuted on its own (or any other
  shuffle passed as `shuffle`), against the observed silhouette; one-sided p with the +1 rule.
- `diagnostics` assembles the block; a mean bootstrap ARI under MIN_ARI marks the export as a
  counter-example, never a finding.

`save` writes features/clusters/<name>/{inputs.parquet, run/assignments.parquet,
run/metrics.json} and records the run in the cluster_lab registry (one SQLite ledger per
warehouse, cluster_lab/clusters/registry.sqlite); the run id is a digest of the inputs, the
settings and the labels, so an unchanged rerun keeps its id.
"""
from __future__ import annotations

import hashlib
import json
import os
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.metrics import adjusted_mutual_info_score, adjusted_rand_score, silhouette_score

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))
from ml.cluster_lab.registry import Registry  # noqa: E402

SEED = 20261022
MIN_ARI = 0.6
FEATURES = Path(os.environ.get("PORTFOLIO_FEATURES", ROOT / "warehouse/features")) / "clusters"
LAB = Path(os.environ.get("PORTFOLIO_CLUSTER_LAB", ROOT / "warehouse/cluster_lab")) / "clusters"
DATABASE = Path(os.environ.get("PORTFOLIO_DB", ROOT / "warehouse/portfolio.duckdb"))
PUBLIC = ROOT / "frontend/public/data"
ASSIGNMENT_COLUMNS = ["clustering", "entity_id", "entity_name", "period", "cluster", "probability"]


def kmeans(k: int, seed: int = 42, n_init: int = 10):
    return lambda x: KMeans(k, n_init=n_init, random_state=seed).fit_predict(x)


def silhouette(x: np.ndarray, labels: np.ndarray, metric: str = "euclidean") -> float | None:
    keep = labels >= 0
    if not 1 < len(set(labels[keep])) < keep.sum():
        return None
    return round(float(silhouette_score(x[keep] if metric != "precomputed" else x[np.ix_(keep, keep)],
                                        labels[keep], metric=metric)), 4)


def choose_k(x: np.ndarray, ks, fit=kmeans, metric: str = "euclidean") -> tuple[int, dict]:
    """k with the highest silhouette in the fitted space, and the whole sweep."""
    sweep = {k: silhouette(x, fit(k)(x), metric) for k in ks}
    return max(sweep, key=lambda k: sweep[k] if sweep[k] is not None else -1), sweep


def summary(values, rounds: int, seed: int, method: str) -> dict:
    values = np.asarray(values, dtype=float)
    return {"mean": round(float(values.mean()), 4), "p05": round(float(np.percentile(values, 5)), 4),
            "p95": round(float(np.percentile(values, 95)), 4), "rounds": rounds, "seed": seed, "method": method}


def bootstrap_ari(x: np.ndarray, labels: np.ndarray, fit, rounds: int = 100, seed: int = SEED,
                  method: str = "rows drawn with replacement, refitted, compared on the drawn rows") -> dict:
    rng = np.random.default_rng(seed)
    scores = []
    for _ in range(rounds):
        rows = rng.integers(0, len(x), len(x))
        refit = np.asarray(fit(x[rows]))
        _, first = np.unique(rows, return_index=True)
        scores.append(adjusted_rand_score(labels[rows[first]], refit[first]))
    return summary(scores, rounds, seed, method)


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
                reference: dict | None = None, space: str = "", note: str = "") -> dict:
    """The "how sure" block. `reference` maps a known label set to its AMI with the clusters."""
    labels = np.asarray(labels)
    ari = (stability or {}).get("mean")
    status = "unvalidated" if ari is None else ("finding" if ari >= MIN_ARI else "counter_example")
    return {"n": int(len(labels)), "k": int(len(set(labels[labels >= 0]))),
            "noise_share": round(float((labels < 0).mean()), 4),
            "largest_share": round(float(np.bincount(labels[labels >= 0]).max() / len(labels)), 4) if (labels >= 0).any() else None,
            "silhouette_original": silhouette_value, "silhouette_space": space,
            "bootstrap_ari": stability, "null": null, "ami_reference": reference or {},
            "status": status, "min_ari": MIN_ARI, **({"note": note} if note else {})}


def digest(value) -> str:
    return hashlib.sha256(json.dumps(value, sort_keys=True, default=str).encode()).hexdigest()


def save(name: str, inputs: pd.DataFrame, assignments: pd.DataFrame, metrics: dict,
         shares: pd.DataFrame | None = None) -> str:
    """Write the features and register the run; returns the run id, also written into metrics."""
    missing = set(ASSIGNMENT_COLUMNS) - set(assignments.columns)
    if missing:
        raise ValueError(f"{name}: assignments lack {sorted(missing)}")
    run_id = digest([name, pd.util.hash_pandas_object(inputs, index=False).sum(),
                     metrics.get("method"), assignments.cluster.tolist()])[:24]
    metrics = {**metrics, "name": name, "run_id": run_id}
    folder = FEATURES / name
    (folder / "run").mkdir(parents=True, exist_ok=True)
    inputs.to_parquet(folder / "inputs.parquet", index=False)
    assignments[ASSIGNMENT_COLUMNS].to_parquet(folder / "run/assignments.parquet", index=False)
    if shares is not None:
        shares.assign(clustering=name).to_parquet(folder / "run/shares.parquet", index=False)
    (folder / "run/metrics.json").write_text(json.dumps(metrics, ensure_ascii=False, indent=1, default=float) + "\n",
                                             encoding="utf-8", newline="\n")
    registry = Registry(LAB)
    with registry.writer():
        registry.put(run_id, "run", "completed", {"name": name, "folder": str(folder / "run"),
                                                  "method": metrics.get("method"),
                                                  "diagnostics": metrics.get("diagnostics")})
    registry.close()
    print(f"{name}: run {run_id}, {metrics.get('diagnostics', {}).get('status')}")
    return run_id


def frame(clustering: str, ids, names, period, labels, probability=None) -> pd.DataFrame:
    return pd.DataFrame({"clustering": clustering, "entity_id": [str(i) for i in ids],
                         "entity_name": [str(n) for n in names], "period": str(period) if np.isscalar(period) else
                         [str(p) for p in period], "cluster": np.asarray(labels, dtype=int),
                         "probability": np.nan if probability is None else probability})
