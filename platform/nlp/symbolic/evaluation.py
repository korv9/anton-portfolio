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
- neighbourhood: for each point, the share of its k nearest neighbours in the embedding space
  that share its book, tradition or symbol, next to the share expected by chance. It needs no
  map and no clusters, so it compares embedding models without HDBSCAN's parameters, which
  were set for one model.
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


# A cluster counts as cross-book when it draws on at least this many books and no single
# book holds more than this share of it.
CROSS_BOOK_MIN_BOOKS = 3
CROSS_BOOK_MAX_SHARE = 0.5


def normalized_entropy(counts: list[int], categories: int) -> float:
    """Shannon entropy of the counts divided by log(categories), from 0 to 1.

    `categories` is the number of possible values in the whole experiment (e.g. ten books), not
    only those present in the cluster, so 1.0 means spread evenly over every book in the corpus
    and clusters of different make-up are comparable. One category gives 0.
    """
    total = sum(counts)
    if categories <= 1 or total == 0:
        return 0.0
    p = np.asarray([c for c in counts if c], dtype=float) / total
    return float(-(p * np.log(p)).sum() / np.log(categories))


def is_cross_book(book_count: int, largest_book_share: float) -> bool:
    return book_count >= CROSS_BOOK_MIN_BOOKS and largest_book_share <= CROSS_BOOK_MAX_SHARE


def cluster_composition(labels: np.ndarray, books: list[str], traditions: list[str],
                        symbols: list[str]) -> list[dict]:
    """One row per non-noise cluster: counts, largest share and normalised entropy of its
    books, traditions and symbols, and whether it is a cross-book cluster."""
    from collections import Counter

    n_books, n_trad, n_sym = len(set(books)), len(set(traditions)), len(set(symbols))
    rows = []
    for c in sorted(set(int(x) for x in labels) - {-1}):
        idx = np.flatnonzero(labels == c)
        row = {"cluster_id": c, "occurrence_count": int(len(idx))}
        for name, values, total in (("book", books, n_books), ("tradition", traditions, n_trad),
                                    ("symbol", symbols, n_sym)):
            counts = Counter(values[i] for i in idx)
            top, top_n = counts.most_common(1)[0]
            row[f"{name}_count"] = len(counts)
            row[f"largest_{name}"] = top
            row[f"largest_{name}_share"] = round(top_n / len(idx), 4)
            row[f"{name}_entropy"] = round(normalized_entropy(list(counts.values()), total), 4)
        row["cross_book_cluster"] = is_cross_book(row["book_count"], row["largest_book_share"])
        rows.append(row)
    return rows


def composition_summary(rows: list[dict], occurrences: int) -> dict:
    """Experiment-level means of the cluster composition, both per cluster (each cluster
    counts once) and per occurrence (each cluster weighted by its size)."""
    out: dict = {}
    sizes = np.asarray([r["occurrence_count"] for r in rows], dtype=float)
    for key in ("largest_book_share", "largest_tradition_share", "largest_symbol_share",
                "book_entropy", "tradition_entropy", "symbol_entropy"):
        values = np.asarray([r[key] for r in rows], dtype=float)
        out[f"mean_{key}"] = round(float(values.mean()), 4) if len(rows) else None
        out[f"weighted_mean_{key}"] = round(float((values * sizes).sum() / sizes.sum()), 4) if len(rows) else None
    for n in (2, 3, 4):
        out[f"clusters_with_{n}plus_books"] = sum(r["book_count"] >= n for r in rows)
    for n in (2, 3):
        out[f"clusters_with_{n}plus_traditions"] = sum(r["tradition_count"] >= n for r in rows)
    cross = [r for r in rows if r["cross_book_cluster"]]
    out["cross_book_cluster_count"] = len(cross)
    out["cross_book_occurrence_share"] = round(sum(r["occurrence_count"] for r in cross) / occurrences, 4) \
        if occurrences else 0.0
    out["cross_book_rule"] = {"min_books": CROSS_BOOK_MIN_BOOKS, "max_largest_book_share": CROSS_BOOK_MAX_SHARE}
    return out


def representatives(space: np.ndarray, labels: np.ndarray, top: int = 7) -> list[tuple[int, int, int, float]]:
    """For each non-noise cluster, its `top` members nearest the cluster's centroid in the
    clustering space: (cluster_id, rank, row index, distance). Ties break by row index."""
    out = []
    for c in sorted(set(int(x) for x in labels) - {-1}):
        idx = np.flatnonzero(labels == c)
        centroid = space[idx].mean(axis=0)
        dist = np.linalg.norm(space[idx] - centroid, axis=1)
        order = np.lexsort((idx, dist))[:top]
        out += [(c, rank + 1, int(idx[j]), round(float(dist[j]), 5)) for rank, j in enumerate(order)]
    return out


def neighbourhood(vectors: np.ndarray, groups: dict[str, list[str]], k: int = 10,
                  chunk: int = 1024) -> dict:
    """{name: {"share", "chance"}} for each grouping: the mean share of a point's k nearest
    neighbours (cosine, the point itself left out) in its own group, and the share a random
    neighbour would have. Vectors must be L2-normalised."""
    n = len(vectors)
    codes = {name: np.unique(np.asarray(g), return_inverse=True)[1] for name, g in groups.items()}
    hits = {name: 0 for name in groups}
    for start in range(0, n, chunk):
        sims = vectors[start:start + chunk] @ vectors.T
        rows = np.arange(sims.shape[0])
        sims[rows, rows + start] = -np.inf
        nearest = np.argpartition(-sims, k, axis=1)[:, :k]
        for name, c in codes.items():
            hits[name] += int((c[nearest] == c[start:start + chunk, None]).sum())
    out = {}
    for name, c in codes.items():
        sizes = np.bincount(c).astype(np.float64)
        out[name] = {"share": round(hits[name] / (n * k), 4),
                     "chance": round(float((sizes * (sizes - 1)).sum() / (n * (n - 1))), 4)}
    return out


def summary(metrics: dict) -> str:
    p = metrics["membership_probability"] or {}
    return (f"{metrics['occurrences']} occurrences, {metrics['clusters']} clusters, "
            f"{metrics['noise_share']:.0%} noise, trustworthiness {metrics['trustworthiness']}, "
            f"silhouette {metrics['silhouette']}, median membership {p.get('median')}, "
            f"composition {metrics.get('composition')}")
