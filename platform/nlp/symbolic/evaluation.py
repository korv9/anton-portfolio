"""Numbers that describe the map and the clusters. They do not show the clusters mean anything.

- trustworthiness: how far each point's nearest neighbours on the 2-D map are its neighbours
  in the embedding space (1 is perfect), on a fixed sample of at most 2,000 points.
- cluster count and sizes, the share of points left as noise, and HDBSCAN's membership
  probability (median and quartiles) for clustered points.
- silhouette on the clustered points in the 10-D clustering space (-1 to 1), when there are
  at least two clusters.
- composition: per cluster, the share of its largest book and of its largest symbol, averaged
  over clusters. A high book share means the clusters follow a book's style or translation more
  than a symbol's meaning, which is worth knowing before reading anything into them.
"""
from __future__ import annotations

import numpy as np

SAMPLE = 2000


def evaluate(vectors: np.ndarray, layout: np.ndarray, space: np.ndarray, labels: np.ndarray,
             probabilities: np.ndarray, seed: int = 42) -> dict:
    from sklearn.manifold import trustworthiness
    from sklearn.metrics import silhouette_score

    rng = np.random.default_rng(seed)
    pick = rng.choice(len(vectors), size=min(SAMPLE, len(vectors)), replace=False)
    clusters = sorted(set(labels) - {-1})
    sizes = {int(c): int((labels == c).sum()) for c in clusters}
    member = labels != -1
    out = {
        "occurrences": int(len(labels)),
        "clusters": len(clusters),
        "cluster_sizes": sizes,
        "noise_share": round(float((~member).mean()), 4),
        "trustworthiness": round(float(trustworthiness(vectors[pick], layout[pick], n_neighbors=10,
                                                       metric="cosine")), 4),
        "membership_probability": None,
        "silhouette": None,
    }
    if member.any():
        q = np.quantile(probabilities[member], [0.25, 0.5, 0.75])
        out["membership_probability"] = {"q25": round(float(q[0]), 3), "median": round(float(q[1]), 3),
                                         "q75": round(float(q[2]), 3)}
    if len(clusters) >= 2:
        idx = np.flatnonzero(member)
        if len(idx) > SAMPLE:
            idx = rng.choice(idx, size=SAMPLE, replace=False)
        out["silhouette"] = round(float(silhouette_score(space[idx], labels[idx])), 4)
    return out


def composition(labels: np.ndarray, documents: list[str], symbols: list[str]) -> dict:
    """Mean share of each cluster's largest book and largest symbol."""
    from collections import Counter

    book, symbol = [], []
    for c in sorted(set(labels) - {-1}):
        idx = np.flatnonzero(labels == c)
        book.append(Counter(documents[i] for i in idx).most_common(1)[0][1] / len(idx))
        symbol.append(Counter(symbols[i] for i in idx).most_common(1)[0][1] / len(idx))
    if not book:
        return {"largest_book_share": None, "largest_symbol_share": None}
    return {"largest_book_share": round(float(np.mean(book)), 3),
            "largest_symbol_share": round(float(np.mean(symbol)), 3)}


def summary(metrics: dict) -> str:
    p = metrics["membership_probability"] or {}
    return (f"{metrics['occurrences']} occurrences, {metrics['clusters']} clusters, "
            f"{metrics['noise_share']:.0%} noise, trustworthiness {metrics['trustworthiness']}, "
            f"silhouette {metrics['silhouette']}, median membership {p.get('median')}, "
            f"composition {metrics.get('composition')}")
