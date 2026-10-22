"""Three Swedens (H4, idea I-2): do social, job-ad and vote similarity of municipalities agree?

    python -m ml.three_swedens

Follows docs/sweden-three-spaces-preregistration.md. Reads the published 2024 indicators and
boundaries (sweden/similarity), gold.mart_job_ad_municipality_field and
gold.fct_election_municipality. Writes features/clusters/three-swedens/run/{metrics.json,
municipalities.parquet}; dbt reads the parquet into gold.mart_municipality_three_spaces and
platform/publish/clusters/three_swedens.py exports clusters/three-swedens.json.
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from itertools import combinations
from pathlib import Path

import duckdb
import numpy as np
import pandas as pd
from scipy.stats import hypergeom
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
from sklearn.metrics import adjusted_rand_score, silhouette_score
from sklearn.preprocessing import StandardScaler

from ml.cluster_lab.io import atomic_json, atomic_parquet
from ml.research.regions import bootstrap_ari

ROOT = Path(__file__).resolve().parents[1]
DATABASE = Path(os.environ.get("PORTFOLIO_DB", ROOT / "warehouse/portfolio.duckdb"))
OUT = Path(os.environ.get("PORTFOLIO_FEATURES", ROOT / "warehouse/features")) / "clusters/three-swedens/run"
SIMILARITY = ROOT / "frontend/public/data/sweden/similarity"
SEED = 20261022
PERMUTATIONS = 9_999
SUBSAMPLES, SUBSAMPLE_SHARE = 1_000, 0.8
NEIGHBOURS, MISFITS = 10, 20
JOB_YEARS, MIN_ADS = (2023, 2024, 2025), 900
PARTIES = ["S", "SD", "M", "C", "KD", "V", "L", "MP", "OTHER"]
SPACES = ["social", "jobs", "votes"]
GROUP_KS, GROUP_ROUNDS = (2, 4), 200


def clr(counts: np.ndarray) -> np.ndarray:
    logs = np.log(counts + 0.5)
    return logs - logs.mean(axis=1, keepdims=True)


def distances(x: np.ndarray) -> np.ndarray:
    return np.sqrt(((x[:, None, :] - x[None, :, :]) ** 2).sum(axis=2))


def centroid(ring) -> tuple[float, float]:
    """Area centroid of one closed or open polygon ring (shoelace)."""
    p = np.asarray(ring, dtype=float)
    x, y = p[:, 0], p[:, 1]
    x1, y1 = np.roll(x, -1), np.roll(y, -1)
    cross = x * y1 - x1 * y
    area = cross.sum() / 2
    return float(((x + x1) * cross).sum() / (6 * area)), float(((y + y1) * cross).sum() / (6 * area))


def ring_area(ring) -> float:
    p = np.asarray(ring, dtype=float)
    return abs(float((p[:, 0] * np.roll(p[:, 1], -1) - np.roll(p[:, 0], -1) * p[:, 1]).sum())) / 2


def residual(v: np.ndarray, g: np.ndarray) -> np.ndarray:
    design = np.column_stack([np.ones_like(g), g])
    return v - design @ np.linalg.lstsq(design, v, rcond=None)[0]


def mantel(a: np.ndarray, b: np.ndarray, geo: np.ndarray, rng, permutations: int = PERMUTATIONS) -> dict:
    """Mantel and partial Mantel (geography held constant), one-sided permutation p with the +1 rule.
    Rows and columns of `a` are permuted together; `b` and `geo` stay fixed."""
    iu = np.triu_indices(len(a), 1)
    y, g = b[iu], geo[iu]
    ry = residual(y, g)
    r = lambda x: float(np.corrcoef(x, y)[0, 1])
    pr = lambda x: float(np.corrcoef(residual(x, g), ry)[0, 1])
    observed, partial = r(a[iu]), pr(a[iu])
    above = above_partial = 0
    for _ in range(permutations):
        p = rng.permutation(len(a))
        x = a[np.ix_(p, p)][iu]
        above += r(x) >= observed
        above_partial += pr(x) >= partial
    return {"r": observed, "partial_r": partial, "p": (1 + above) / (1 + permutations),
            "partial_p": (1 + above_partial) / (1 + permutations), "permutations": permutations}


def subsample_range(a, b, geo, rng) -> dict:
    n, size = len(a), int(round(SUBSAMPLE_SHARE * len(a)))
    rs, prs = [], []
    for _ in range(SUBSAMPLES):
        s = np.sort(rng.choice(n, size, replace=False))
        iu = np.triu_indices(size, 1)
        x, y, g = (m[np.ix_(s, s)][iu] for m in (a, b, geo))
        rs.append(np.corrcoef(x, y)[0, 1])
        prs.append(np.corrcoef(residual(x, g), residual(y, g))[0, 1])
    q = lambda v: [round(float(np.percentile(v, 2.5)), 4), round(float(np.percentile(v, 97.5)), 4)]
    return {"r": q(rs), "partial_r": q(prs), "subsamples": SUBSAMPLES, "share": SUBSAMPLE_SHARE}


def holm(ps: list[float]) -> list[float]:
    order = np.argsort(ps)
    adjusted, running = [0.0] * len(ps), 0.0
    for rank, i in enumerate(order):
        running = max(running, min(1.0, (len(ps) - rank) * ps[i]))
        adjusted[i] = running
    return adjusted


def nearest(d: np.ndarray, k: int = NEIGHBOURS) -> np.ndarray:
    """Indices of each row's k nearest, itself excluded; rows are in code order, so the stable
    sort breaks ties by municipality code."""
    d = d.copy()
    np.fill_diagonal(d, np.inf)
    return np.argsort(d, axis=1, kind="stable")[:, :k]


def jaccard(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    return np.array([len(set(x) & set(y)) / len(set(x) | set(y)) for x, y in zip(a, b)])


def chance_jaccard(n: int, k: int = NEIGHBOURS) -> float:
    """Expected Jaccard of two random k-sets from the n - 1 other municipalities."""
    overlap = np.arange(k + 1)
    return float((hypergeom(n - 1, k, k).pmf(overlap) * overlap / (2 * k - overlap)).sum())


def group_fit(k: int):
    def fit(scaled: np.ndarray) -> np.ndarray:
        return KMeans(k, n_init=20, random_state=SEED).fit_predict(PCA(4).fit_transform(scaled))
    return fit


def grouping(indicators: np.ndarray, spaces: dict[str, np.ndarray], published: dict[int, np.ndarray]) -> dict:
    """The pre-registered k = 2 against k = 4 rule, with its evidence."""
    scaled = StandardScaler().fit_transform(indicators)
    space = PCA(4).fit_transform(scaled)
    out = {}
    for k in GROUP_KS:
        fit = group_fit(k)
        labels = fit(scaled)
        rng = np.random.default_rng(SEED)
        aris = [bootstrap_ari(fit, scaled, labels, rng, 1) for _ in range(GROUP_ROUNDS)]
        observed = float(silhouette_score(space, labels))
        null = []
        for _ in range(GROUP_ROUNDS):
            mixed = StandardScaler().fit_transform(np.column_stack([rng.permutation(c) for c in indicators.T]))
            null.append(silhouette_score(PCA(4).fit_transform(mixed), fit(mixed)))
        p = (1 + int((np.asarray(null) >= observed).sum())) / (1 + GROUP_ROUNDS)
        ari = {"mean": round(float(np.mean(aris)), 4), "p05": round(float(np.percentile(aris, 5)), 4),
               "p95": round(float(np.percentile(aris, 95)), 4), "rounds": GROUP_ROUNDS}
        out[k] = {"k": k, "labels": labels, "silhouette": round(observed, 4), "bootstrap_ari": ari,
                  "null": {"median": round(float(np.median(null)), 4), "p95": round(float(np.percentile(null, 95)), 4),
                           "p": round(p, 4), "rounds": GROUP_ROUNDS, "kind": "each indicator permuted on its own"},
                  "qualifies": ari["mean"] >= 0.75 and ari["p05"] >= 0.6 and p < 0.05,
                  "ari_with_published": round(float(adjusted_rand_score(published[k], labels)), 4),
                  "silhouette_in": {s: round(float(silhouette_score(x, labels)), 4) for s, x in spaces.items()}}
    qualifying = [g for g in out.values() if g["qualifies"]]
    chosen = max(qualifying, key=lambda g: (round(g["bootstrap_ari"]["p05"], 3), -g["k"]))["k"] if qualifying else None
    bar = "mean bootstrap ARI at least 0.75, 5th percentile at least 0.6 and null p below 0.05"
    note = (f"The site uses k = {chosen}: it meets the pre-registered bar ({bar}) with the higher 5th percentile ARI."
            if chosen else f"Neither k = 2 nor k = 4 meets the pre-registered bar ({bar}), so the site shows "
                           "no municipality grouping as a finding.")
    return {"chosen_k": chosen, "candidates": out, "note": note}


def load() -> tuple:
    """One row per municipality in all three spaces with a boundary, in code order, and the drops."""
    sim = json.loads((SIMILARITY / "municipalities.json").read_text(encoding="utf-8"))
    features = [f["id"] for f in sim["features"]]
    social = pd.DataFrame([{"municipality_code": m["code"], "municipality_name": m["name"], "group_k2": m.get("group"),
                            "group_k4": m.get("finer"), **{f: m["values"].get(f) for f in features}}
                           for m in sim["municipalities"]]).dropna(subset=features)
    with duckdb.connect(str(DATABASE), read_only=True) as con:
        con.sql("set memory_limit='1GB'")
        ads = con.execute("""select municipality_code, occupation_field, sum(ads) as ads
                             from gold.mart_job_ad_municipality_field where year in (select unnest(?))
                             group by all""", [list(JOB_YEARS)]).df()
        votes = con.execute("""select municipality_code, party, votes from gold.fct_election_municipality
                               where election_year = 2022 and votes is not null""").df()
    jobs = ads.pivot_table(index="municipality_code", columns="occupation_field", values="ads", fill_value=0, aggfunc="sum")
    jobs = jobs[jobs.sum(axis=1) >= MIN_ADS]
    votes = votes.pivot_table(index="municipality_code", columns="party", values="votes", aggfunc="sum")[PARTIES].dropna()
    geometry = json.loads((SIMILARITY / "geometry.json").read_text(encoding="utf-8"))
    scale = 0.1  # geometry units are 100 m; kilometres
    centres = {m["code"]: centroid(max(m["rings"], key=ring_area)) for m in geometry["municipalities"]}
    codes = sorted(set(social.municipality_code) & set(jobs.index) & set(votes.index) & set(centres))
    frame = social.set_index("municipality_code").loc[codes]
    drops = {"in_space": {"social": int(len(social)), "jobs": int(len(jobs)), "votes": int(len(votes)),
                          "boundaries": len(centres)},
             "jobs_below_minimum": int(ads.municipality_code.nunique() - len(jobs))}
    return frame, features, jobs.loc[codes], votes.loc[codes], np.array([centres[c] for c in codes]) * scale, drops


def main() -> None:
    frame, features, jobs, votes, xy, drops = load()
    codes = frame.index.to_numpy()
    indicators = frame[features].to_numpy(float)
    spaces = {"social": StandardScaler().fit_transform(indicators), "jobs": clr(jobs.to_numpy(float)),
              "votes": clr(votes.to_numpy(float))}
    d = {s: distances(x) for s, x in spaces.items()}
    geo = distances(xy)
    tests = []
    for i, (a, b) in enumerate(combinations(SPACES, 2)):
        result = mantel(d[a], d[b], geo, np.random.default_rng(SEED))
        tests.append({"pair": [a, b], **result, **{"range": subsample_range(d[a], d[b], geo, np.random.default_rng(SEED + i))}})
    for t, adjusted in zip(tests, holm([t["partial_p"] for t in tests])):
        t["partial_p_holm"] = round(adjusted, 4)
        t["reading"] = "agree" if adjusted < 0.05 else "no measurable agreement"
        for key in ("r", "partial_r"):
            t[key] = round(t[key], 4)
    near = {s: nearest(m) for s, m in d.items()}
    pairs = {f"jaccard_{a}_{b}": jaccard(near[a], near[b]) for a, b in combinations(SPACES, 2)}
    agreement = np.mean(list(pairs.values()), axis=0)
    rank = np.lexsort((codes, agreement))[:MISFITS]
    misfit_rank = np.full(len(codes), np.nan)
    misfit_rank[rank] = np.arange(1, MISFITS + 1)
    groups = grouping(indicators, {s: spaces[s] for s in ("jobs", "votes")},
                      {2: frame.group_k2.to_numpy(int), 4: frame.group_k4.to_numpy(int)})
    rows = pd.DataFrame({"municipality_code": codes, "municipality_name": frame.municipality_name.to_numpy(),
                         "agreement": agreement.round(4), **{k: v.round(4) for k, v in pairs.items()},
                         "misfit_rank": pd.array(misfit_rank, dtype="Int64"),
                         **{f"neighbours_{s}": [list(codes[r]) for r in near[s]] for s in SPACES},
                         "group_k2": frame.group_k2.to_numpy(int), "group_k4": frame.group_k4.to_numpy(int)})
    candidates = {str(k): {key: v for key, v in g.items() if key != "labels"} for k, g in groups["candidates"].items()}
    metrics = {
        "name": "three-swedens", "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "preregistration": "docs/sweden-three-spaces-preregistration.md",
        "method": {"social": f"{len(features)} indicators of sweden/similarity (2024), standardised; Euclidean",
                   "jobs": f"CLR of distinct ads (+0.5) over {jobs.shape[1]} occupation fields, "
                           f"{JOB_YEARS[0]}-{JOB_YEARS[-1]} pooled, at least {MIN_ADS} ads; Aitchison",
                   "votes": "CLR of 2022 Riksdag votes (+0.5) for " + ", ".join(PARTIES) + "; Aitchison",
                   "geography": "km between largest-ring centroids, SWEREF 99 TM",
                   "mantel": f"Pearson r of upper triangles; partial r after regressing both on geography; "
                             f"{PERMUTATIONS} permutations of the first matrix, one-sided, +1 rule; Holm over the pairs",
                   "neighbours": NEIGHBOURS, "misfits": MISFITS, "seed": SEED, "departures": []},
        "coverage": {"n": int(len(codes)), **drops},
        "diagnostics": {"n": int(len(codes)), "tests": tests,
                        "chance_jaccard": round(chance_jaccard(len(codes)), 4),
                        "agreement_median": round(float(np.median(agreement)), 4),
                        # Ties at the cut-off are broken by code (pre-registered); the reader sees how many.
                        "misfit_cutoff": {"agreement": round(float(agreement[rank[-1]]), 4),
                                          "at_or_below": int((agreement <= agreement[rank[-1]]).sum())}},
        "grouping": {"chosen_k": groups["chosen_k"], "candidates": candidates, "note": groups["note"]},
    }
    OUT.mkdir(parents=True, exist_ok=True)
    atomic_parquet(rows, OUT / "municipalities.parquet")
    atomic_json(OUT / "metrics.json", json.loads(json.dumps(metrics, allow_nan=False)))
    print(json.dumps({"n": len(codes), "tests": tests, "grouping": groups["chosen_k"]}, indent=1))


if __name__ == "__main__":
    main()
