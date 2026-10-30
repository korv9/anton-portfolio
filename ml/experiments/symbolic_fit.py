"""Symbol Lab fitting helpers on top of the shared core.

- `fit_grid` measures several clusterings of one representation and reduction, reducing once per
  seed. It assembles exactly the metrics `fit.evaluate_candidate` does (that function reduces again
  for every clustering, which would multiply the UMAP cost of a grid by its size).
- `terms` gives each group generated terms (class TF-IDF over its contexts) and measures
  book-specific phrasing: the share of a group's top terms that occur almost only in one book
  (names, a translator's spellings), a sign the group follows a book's wording.
- `examples` picks representative and borderline members by distance to the group centre.
"""
from __future__ import annotations

import numpy as np

from . import evaluate as ev
from . import fit

TOP_TERMS = 8
ONE_BOOK = 0.8  # a term is book-specific when at least this share of its sample uses is in one book


def metrics_of(labelings: list[np.ndarray], first_space: np.ndarray, rep: np.ndarray, confounders: dict) -> dict:
    labels = labelings[0]
    metrics = ev.structure(labels)
    metrics['seed_stability'] = ev.seed_stability(labelings)
    metrics['separation_clustered'] = ev.separation(first_space, labels, 'euclidean')
    metrics['separation_representation'] = ev.separation(rep, labels, 'cosine')
    metrics['dominance'] = {name: ev.dominance(labels, values) for name, values in confounders.items()}
    metrics['seed_noise_shares'] = [float((l < 0).mean()) for l in labelings]
    metrics['seed_cluster_counts'] = [int(len(set(l[l >= 0]))) for l in labelings]
    return metrics


def fit_grid(vectors: np.ndarray, representation: dict, reduction: dict, clusterings: dict, seeds: list[int],
             confounders: dict, groups=None) -> dict:
    """{name: (labels of first seed, metrics)} for every clustering spec in `clusterings`."""
    rep = fit.represent(vectors, representation['kind'], groups)
    spaces = [fit.reduce(rep, reduction, seed) for seed in seeds]
    out = {}
    for name, spec in clusterings.items():
        labelings = [fit.cluster(space, spec, seed) for space, seed in zip(spaces, seeds)]
        out[name] = (labelings[0], metrics_of(labelings, spaces[0], rep, confounders))
    out['_space'] = spaces[0]
    out['_rep'] = rep
    return out


def terms(texts: list[str], labels: np.ndarray, books: np.ndarray, top: int = TOP_TERMS) -> tuple[dict, dict]:
    """({cluster: [terms]}, book-specific phrasing summary)."""
    from sklearn.feature_extraction.text import CountVectorizer

    labels, books = np.asarray(labels), np.asarray(books).astype(str)
    vectorizer = CountVectorizer(stop_words='english', min_df=3, token_pattern=r'(?u)\b[a-zA-Z][a-zA-Z]{2,}\b')
    counts = vectorizer.fit_transform(texts).tocsr()
    vocab = np.asarray(vectorizer.get_feature_names_out())
    # Book concentration of each term: largest single-book share of the documents using it.
    present = (counts > 0).astype(np.int32)
    book_ids, book_index = np.unique(books, return_inverse=True)
    from scipy.sparse import csr_matrix
    onehot = csr_matrix((np.ones(len(books)), (book_index, np.arange(len(books)))), shape=(len(book_ids), len(books)))
    per_book = (onehot @ present).toarray()
    concentration = per_book.max(axis=0) / np.maximum(per_book.sum(axis=0), 1)
    clusters = [c for c in np.unique(labels) if c >= 0]
    if not clusters:
        return {}, {'clusters': 0, 'book_specific_term_share': None}
    by_cluster = np.vstack([np.asarray(counts[labels == c].sum(axis=0)).ravel() for c in clusters]).astype(float)
    tf = by_cluster / np.maximum(by_cluster.sum(axis=1, keepdims=True), 1)
    idf = np.log(1 + by_cluster.sum(axis=1).mean() / np.maximum(by_cluster.sum(axis=0), 1))
    score = tf * idf
    out, specific = {}, []
    for row, c in enumerate(clusters):
        best = np.argsort(-score[row])[:top]
        best = best[score[row, best] > 0]
        out[int(c)] = vocab[best].tolist()
        if len(best):
            specific.append(float((concentration[best] >= ONE_BOOK).mean()))
    return out, {'clusters': len(clusters), 'top_terms': top, 'one_book_threshold': ONE_BOOK,
                 'book_specific_term_share': float(np.mean(specific)) if specific else None}


def examples(space: np.ndarray, labels: np.ndarray, cluster: int, representative: int = 3) -> tuple[list[int], int | None]:
    """Indices of the members nearest the group centre, and of the member farthest from it."""
    members = np.flatnonzero(labels == cluster)
    if not len(members):
        return [], None
    distance = np.linalg.norm(space[members] - space[members].mean(axis=0), axis=1)
    order = members[np.argsort(distance)]
    border = int(order[-1]) if len(order) > representative else None
    return order[:representative].tolist(), border
