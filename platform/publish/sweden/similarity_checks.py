"""SWEDEN C's checks of how much of the similarity map is the definition (research plan 2.3).

Pure functions over the analysed matrix; export_similarity.py reads the inputs and writes the
results into groups.json. Seeds are fixed and written into the output.

- copula_null: silhouette of K-means on data with the observed rank correlation and each
  indicator's own values (a Gaussian copula), stricter than shuffling columns apart.
- neighbour_stability: overlap of each municipality's five neighbours under other features and
  distances.
- temporal_ari: the same pipeline refitted on an earlier year, against the reference year's groups.
- outcome_eta: share of an outside variable's variance that lies between groups, against
  shuffles of the variable over municipalities, Holm-adjusted over the family.
- metro_gradient: rank correlation between the first principal component and distance to the
  nearest of the three big cities, with a county-cluster bootstrap interval.
- typology_share: share of the indicators' variance that lies between SKR's types.
"""
from __future__ import annotations

import numpy as np
from scipy.stats import rankdata, spearmanr
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
from sklearn.metrics import adjusted_rand_score, silhouette_score

SEED = 20261021
CLUSTER_SEED = 42  # the clustering run's own seed (configs/cluster_lab/public_regions.yaml)


def standardise(x: np.ndarray) -> np.ndarray:
    return (x - x.mean(axis=0)) / x.std(axis=0)


def fit(x: np.ndarray, k: int, components: int, n_init: int = 20) -> tuple[np.ndarray, np.ndarray]:
    """The clustering pipeline: standardise, PCA, K-means. Returns the space and the labels."""
    space = PCA(components).fit_transform(standardise(x))
    return space, KMeans(k, n_init=n_init, random_state=CLUSTER_SEED).fit_predict(space)


def copula_null(x: np.ndarray, observed: dict[int, float], components: int, rounds: int = 200,
                seed: int = SEED) -> dict:
    """Silhouette per k over draws with the observed Spearman correlation and marginals."""
    n, p = x.shape
    rho = spearmanr(x).statistic
    corr = 2 * np.sin(np.pi * rho / 6)  # Spearman to the normal copula's correlation
    w, v = np.linalg.eigh(corr)
    root = v * np.sqrt(np.clip(w, 1e-9, None))
    ordered = np.sort(x, axis=0)
    rng = np.random.default_rng(seed)
    scores = {k: [] for k in observed}
    for _ in range(rounds):
        g = rng.standard_normal((n, p)) @ root.T
        draw = np.take_along_axis(ordered, (rankdata(g, axis=0) - 1).astype(int), axis=0)
        for k in observed:
            space, labels = fit(draw, k, components, n_init=10)
            scores[k].append(float(silhouette_score(space, labels)))
    return {"rounds": rounds, "seed": seed,
            "note": "Gaussian copula: the observed rank correlation between indicators and each indicator's own values",
            "silhouette_95": {str(k): round(float(np.percentile(s, 95)), 4) for k, s in scores.items()},
            "silhouette_median": {str(k): round(float(np.median(s)), 4) for k, s in scores.items()},
            "share_at_least_observed": {str(k): (1 + sum(v >= observed[k] for v in s)) / (1 + rounds)
                                        for k, s in scores.items()}}


def nearest(points: np.ndarray, n: int = 5) -> np.ndarray:
    d = np.sqrt(((points[:, None, :] - points[None, :, :]) ** 2).sum(axis=2))
    np.fill_diagonal(d, np.inf)
    return np.argsort(d, axis=1, kind="stable")[:, :n]


def neighbour_stability(x: np.ndarray, features: list[str], components: int, n: int = 5) -> list[dict]:
    """Jaccard overlap of each municipality's n neighbours under each variant, against all 12 indicators."""
    z = standardise(x)
    keep = lambda drop: z[:, [j for j, f in enumerate(features) if f not in drop]]
    w, v = np.linalg.eigh(np.cov(z.T))
    variants = {
        "without_log_population": keep({"log_population"}),
        "without_commuting": keep({"in_commuting_pct", "out_commuting_pct"}),
        "pca_space": PCA(components).fit_transform(z),
        "mahalanobis": z @ v / np.sqrt(w),
    }
    base = nearest(z, n)
    out = []
    for name, points in variants.items():
        other = nearest(points, n)
        jaccard = [len(set(a) & set(b)) / len(set(a) | set(b)) for a, b in zip(base, other)]
        out.append({"variant": name, "median_jaccard": round(float(np.median(jaccard)), 3),
                    "first_neighbour_changed": round(float(np.mean(base[:, 0] != other[:, 0])), 3)})
    return out


def temporal_ari(x: np.ndarray, reference: np.ndarray, k: int, components: int) -> float:
    return round(float(adjusted_rand_score(reference, fit(x, k, components)[1])), 3)


def eta_squared(labels: np.ndarray, y: np.ndarray) -> np.ndarray:
    """Between-group share of variance; y may hold one column per shuffle."""
    y = y.reshape(len(y), -1)
    total = ((y - y.mean(axis=0)) ** 2).sum(axis=0)
    between = sum((labels == g).sum() * (y[labels == g].mean(axis=0) - y.mean(axis=0)) ** 2
                  for g in np.unique(labels))
    return between / total


def holm(p: list[float]) -> list[float]:
    order = np.argsort(p)
    adjusted, running = [0.0] * len(p), 0.0
    for rank, i in enumerate(order):
        running = max(running, min(1.0, (len(p) - rank) * p[i]))
        adjusted[i] = running
    return adjusted


def outcome_eta(splits: dict[str, np.ndarray], outcomes: dict[str, np.ndarray],
                rounds: int = 999, seed: int = SEED) -> dict:
    """Eta squared per split and outcome against shuffles; rows with a missing outcome are dropped."""
    rng = np.random.default_rng(seed)
    rows = []
    for oid, y in outcomes.items():
        ok = ~np.isnan(y)
        shuffled = np.column_stack([rng.permutation(y[ok]) for _ in range(rounds)])
        for sid, labels in splits.items():
            observed = float(eta_squared(labels[ok], y[ok])[0])
            null = eta_squared(labels[ok], shuffled)
            rows.append({"outcome": oid, "split": sid, "n": int(ok.sum()), "eta_squared": round(observed, 3),
                         "null_95": round(float(np.percentile(null, 95)), 3),
                         "p": (1 + int((null >= observed).sum())) / (1 + rounds)})
    for row, adjusted in zip(rows, holm([r["p"] for r in rows])):
        row["p_holm"] = round(adjusted, 4)
    return {"rounds": rounds, "seed": seed, "family": "every outcome against every split", "results": rows}


def first_component(x: np.ndarray, orient: np.ndarray) -> np.ndarray:
    """PC1 of the standardised indicators, signed to rise with the orienting indicator."""
    pc = PCA(1).fit_transform(standardise(x))[:, 0]
    return pc if np.corrcoef(pc, orient)[0, 1] >= 0 else -pc


def metro_gradient(pc1: np.ndarray, km: np.ndarray, county: list[str],
                   rounds: int = 2000, seed: int = SEED) -> dict:
    """Spearman rho of PC1 against distance to the nearest big city, county-cluster bootstrap 95 %."""
    cid = np.unique(county, return_inverse=True)[1]
    members = [np.flatnonzero(cid == c) for c in range(cid.max() + 1)]
    rng = np.random.default_rng(seed)
    boot = []
    for _ in range(rounds):
        rows = np.concatenate([members[c] for c in rng.integers(0, len(members), len(members))])
        boot.append(spearmanr(pc1[rows], km[rows]).statistic)
    return {"rho": round(float(spearmanr(pc1, km).statistic), 3),
            "ci95": [round(float(v), 3) for v in np.percentile(boot, [2.5, 97.5])]}


def typology_share(z: np.ndarray, labels: np.ndarray, rounds: int = 2000, seed: int = SEED) -> dict:
    """Between-type share of the indicators' total variance, with a bootstrap interval and a shuffle reference."""
    share = lambda lab, m: float((eta_squared(lab, m) * m.var(axis=0)).sum() / m.var(axis=0).sum())
    rng = np.random.default_rng(seed)
    boot = [share(labels[i], z[i]) for i in (rng.integers(0, len(z), len(z)) for _ in range(rounds))]
    null = [share(rng.permutation(labels), z) for _ in range(999)]
    return {"share": round(share(labels, z), 3), "ci95": [round(float(v), 3) for v in np.percentile(boot, [2.5, 97.5])],
            "null_95": round(float(np.percentile(null, 95)), 3), "rounds": rounds, "seed": seed}
