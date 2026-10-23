"""One validation for every clustering feature set, so two sets differ only in their features.

Reuses platform/publish/clusters/stats.py: k by silhouette over 2-8, bootstrap ARI (rows drawn
with replacement, refitted), a feature-wise permutation null, AMI with a reference labelling.
The k picked by silhouette is often 2, and ARI is easier at small k, so every set is also scored
at one fixed k. Results are written under tmp/, never to the site.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
from sklearn.metrics import adjusted_rand_score

ROOT = Path(__file__).resolve().parents[2]
TMP = ROOT / "tmp/feature-study"
sys.path.insert(0, str(ROOT / "platform/publish/clusters"))
import stats  # noqa: E402


def standardise(x: np.ndarray) -> np.ndarray:
    sd = x.std(axis=0)
    return (x - x.mean(axis=0)) / np.where(sd > 0, sd, 1)


def cluster_report(x: np.ndarray, fixed_k: int = 4, rounds: int = 100, null_rounds: int = 200,
                   reference: dict | None = None) -> dict:
    """Silhouette, bootstrap ARI and null margin at the silhouette k and at `fixed_k`."""
    out = {"n": int(len(x)), "features": int(x.shape[1])}
    k, sweep = stats.choose_k(x)
    for name, kk in (("chosen", k), ("fixed", fixed_k)):
        fit = stats.kmeans(kk)
        labels = fit(x)
        sil = stats.silhouette(x, labels)
        null = stats.permutation_null(x, sil, fit, rounds=null_rounds)
        out[name] = {"k": kk, "silhouette": sil, "bootstrap_ari": stats.bootstrap_ari(x, labels, fit, rounds),
                     "null_95": null["null_95"], "null_margin": round(sil - null["null_95"], 4), "null_p": null["p"],
                     "ami": {n: stats.ami(labels, r) for n, r in (reference or {}).items()}}
    out["k_sweep"] = sweep
    return out


def period_ari(a: np.ndarray, b: np.ndarray, k: int) -> float:
    """The same fit on two periods' features for the same units, as ARI."""
    return round(float(adjusted_rand_score(stats.kmeans(k)(a), stats.kmeans(k)(b))), 4)


def write(name: str, result: dict) -> Path:
    TMP.mkdir(parents=True, exist_ok=True)
    path = TMP / f"{name}.json"
    path.write_text(json.dumps(result, indent=1, default=float), encoding="utf-8", newline="\n")
    print(json.dumps(result, indent=1, default=float))
    return path
