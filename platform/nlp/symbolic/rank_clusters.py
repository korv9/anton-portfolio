"""Rank an experiment's clusters for human review, and write what a reviewer needs to judge them.

    python platform/nlp/symbolic/rank_clusters.py [experiment]      (default book_centered)

This ranks clusters for *review*, not for meaning. A high review_priority_score says a cluster
is worth a person's time (it draws on many books and traditions, holds its members firmly and
mixes symbols); it says nothing about whether the cluster means anything. Only a person reading
the passages can say that, and only reviewed_clusters.json can give a cluster a name.

review_priority_score, from 0 to 1, a weighted mean of documented components, each 0 to 1:

    0.25  book_entropy                  spread over books (normalised entropy, evaluation.py)
    0.20  tradition_entropy             spread over traditions
    0.20  1 - largest_book_share        no single book dominates
    0.15  avg_membership_probability    HDBSCAN holds the members firmly
    0.10  symbol diversity              min(symbol_count, 5) / 5: not one literal word
    0.10  size                          min(1, log(n) / log(200)): enough passages to judge

Audit flags, which never delete a cluster from the results but decide its review class:

    suspected_paratext  at least PARATEXT_SHARE of its passages read as paratext (an index,
                        glossary, notes or references; looks_like_paratext)
    too_small           fewer than MIN_SIZE passages
    book_dominated      one book holds more than half of it (not cross-book)
    low_membership      mean membership probability below MIN_MEMBERSHIP

    review_class: reject (suspected_paratext or too_small), warning (book_dominated or
    low_membership), otherwise candidate.

Writes warehouse/features/symbolic/review/:

    cluster_candidates.parquet      one row per cluster, sorted by review priority
    representative_passages.parquet centroid and diverse representatives per cluster
    cluster_keywords.parquet        c-TF-IDF terms per cluster (suggestions, never labels)
    cluster_symbols.parquet         symbol mix per cluster
    cluster_traditions.parquet      tradition mix per cluster
    review_summary.json             counts and the top clusters for review

and experiments/post_cleaning_comparison.json when an archived run (experiments/history/
v2-before-cleaning) is there to compare with.
"""
from __future__ import annotations

import hashlib
import json
import math
import re
import sys
from collections import Counter
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import evaluation  # noqa: E402
import pipeline  # noqa: E402
import reviews  # noqa: E402

EXPERIMENTS = pipeline.FEATURES / "experiments"
REVIEW = pipeline.FEATURES / "review"
BEFORE_CLEANING = EXPERIMENTS / "history" / "v2-before-cleaning"
WEIGHTS = {"book_entropy": 0.25, "tradition_entropy": 0.20, "book_spread": 0.20,
           "avg_membership_probability": 0.15, "symbol_diversity": 0.10, "size": 0.10}
MIN_SIZE = 30
MIN_MEMBERSHIP = 0.5
# Calibrated on the run before the paratext cleaning: its two clusters built on glossaries
# (Bulfinch's, the Eddas') had 31 % and 21 % paratext-like passages, every narrative cluster
# at most 9 %.
PARATEXT_SHARE = 0.2
REPRESENTATIVES = 12
KEYWORDS = 15

# ---------------------------------------------------------------------------- paratext

# "Aegisthus, murderer of Agamemnon", "Acestes, son of a Trojan woman", "Abydos, a town on …"
GLOSSARY_ENTRY = re.compile(
    r"\b[A-Z][\w’'-]+,\s+(?:(?:a|an|the|son|daughter|wife|husband|king|queen|god|goddess|name|one|"
    r"see|called|surnamed|father|mother|brother|sister|town|city|river|mountain)\b|"
    r"(?:[a-z]+\s+){0,2}(?:of|for|to|by)\s+[A-Z])")
# "KERLAUG: ker, any kind of vessel", "ÆSIR, sing. AS": headwords in capitals.
HEADWORD = re.compile(r"\b[A-ZÆØÅÄÖ]{3,}[,:]")
PAGE_REFS = re.compile(r"\b\d{1,4}(?:\s*,\s*\d{1,4}){2,}\b|\bp{1,2}\.\s*\d|\b\d{1,4}\s*[-–]\s*\d{1,4}\b")
EDITORIAL = re.compile(r"\[Footnote|\bSee\s+[A-Z]|\bibid\b|\bcf\.|\bMSS?\.?\b|\bed\.|\btrans\.|\bvol\.|"
                       r"\bchap\.|\bvide\b|\bop\. cit\.|\bverse \d|\bl{1,2}\. \d", re.IGNORECASE)


def paratext_signals(context: str) -> dict[str, bool]:
    """The separate signals that a passage is paratext rather than narrative."""
    words = re.findall(r"[A-Za-zÀ-ÿ’'-]+", context)
    capitals = sum(w[0].isupper() for w in words) / len(words) if words else 0.0
    digits = sum(c.isdigit() for c in context) / max(len(context), 1)
    return {
        "capitalised": capitals > 0.35,
        "glossary_entries": len(GLOSSARY_ENTRY.findall(context)) >= 3,
        "headwords": len(HEADWORD.findall(context)) >= 3,
        "page_references": bool(PAGE_REFS.search(context)),
        "editorial_markers": len(EDITORIAL.findall(context)) >= 2,
        "digits": digits > 0.03,
    }


STRONG = {"glossary_entries", "headwords"}


def looks_like_paratext(context: str) -> bool:
    """A run of glossary entries or capitalised headwords is enough on its own; otherwise at
    least two independent signals are needed: a capitalised list of names alone, or one "See",
    is not paratext, a list of names with page numbers is."""
    signals = paratext_signals(context)
    return any(signals[k] for k in STRONG) or sum(signals.values()) >= 2


# ---------------------------------------------------------------------------- scoring


def size_factor(n: int) -> float:
    return min(1.0, math.log(max(n, 1)) / math.log(200))


def review_priority(row: dict) -> float:
    """The weighted mean in the module docstring, rounded to four decimals."""
    parts = {
        "book_entropy": row["book_entropy"],
        "tradition_entropy": row["tradition_entropy"],
        "book_spread": 1 - row["largest_book_share"],
        "avg_membership_probability": row["avg_membership_probability"],
        "symbol_diversity": min(row["symbol_count"], 5) / 5,
        "size": size_factor(row["occurrence_count"]),
    }
    return round(sum(WEIGHTS[k] * v for k, v in parts.items()), 4)


def flags(row: dict, paratext_share: float) -> dict:
    return {
        "suspected_paratext": paratext_share >= PARATEXT_SHARE,
        "too_small": row["occurrence_count"] < MIN_SIZE,
        "book_dominated": not row["cross_book_cluster"],
        "low_membership": row["avg_membership_probability"] < MIN_MEMBERSHIP,
    }


def review_class(f: dict) -> str:
    if f["suspected_paratext"] or f["too_small"]:
        return "reject"
    if f["book_dominated"] or f["low_membership"]:
        return "warning"
    return "candidate"


def fingerprint(member_ids: list[str]) -> str:
    """A cluster's identity across runs: the hash of its sorted member ids. Cluster numbers
    change when anything upstream changes; a review stays attached to the members it read."""
    return hashlib.sha256("\n".join(sorted(member_ids)).encode()).hexdigest()[:16]


# ---------------------------------------------------------------------------- representatives


def centroid_order(space: np.ndarray, idx: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Members of one cluster ordered by distance to its centroid (ties by row), and the distances."""
    centroid = space[idx].mean(axis=0)
    dist = np.linalg.norm(space[idx] - centroid, axis=1)
    order = np.lexsort((idx, dist))
    return idx[order], dist[order]


def diverse_representatives(ordered: list[int], books: list[str], probabilities: np.ndarray,
                            k: int = REPRESENTATIVES) -> list[int]:
    """High-membership members from as many books as possible.

    Among members at or above the cluster's median membership, take the one nearest the
    centroid from each book in turn (books ordered by their nearest member), then fill up by
    distance. A cross-book cluster thus shows a passage from every book before a second one
    from any; a reviewer can see whether the same idea appears across sources.
    """
    if not ordered:
        return []
    median = float(np.median(probabilities[ordered]))
    strong = [i for i in ordered if probabilities[i] >= median] or ordered
    picked, seen = [], set()
    for i in strong:
        if books[i] not in seen:
            picked.append(i)
            seen.add(books[i])
        if len(picked) == k:
            return picked
    for i in strong:
        if i not in picked:
            picked.append(i)
        if len(picked) == k:
            break
    return picked


# ---------------------------------------------------------------------------- keywords

def stop_words() -> list[str]:
    """scikit-learn's English stop words without "fire" (one of the symbols, which that list
    happens to contain), plus the archaic function words of the older translations."""
    from sklearn.feature_extraction.text import ENGLISH_STOP_WORDS

    archaic = {"thee", "thou", "thy", "thine", "ye", "hath", "doth", "unto", "shall", "said",
               "upon", "art", "hast", "thus", "o", "oh", "let", "came", "come", "went", "did"}
    return sorted((ENGLISH_STOP_WORDS - {"fire"}) | archaic)


def ctfidf(texts_by_cluster: dict[int, list[str]], top: int = KEYWORDS) -> list[dict]:
    """Class-based TF-IDF: each cluster's passages as one document; a term scores high when it
    is frequent in the cluster and rare across clusters. tf = count / words in cluster,
    idf = log(1 + mean words per cluster / term count over all clusters)."""
    from sklearn.feature_extraction.text import CountVectorizer

    ids = sorted(texts_by_cluster)
    docs = [" ".join(texts_by_cluster[c]) for c in ids]
    vec = CountVectorizer(stop_words=stop_words(), token_pattern=r"(?u)\b[a-zA-Z][a-zA-Z’']{2,}\b",
                          lowercase=True, min_df=1)
    counts = vec.fit_transform(docs).toarray().astype(float)
    terms = vec.get_feature_names_out()
    words = counts.sum(axis=1, keepdims=True)
    tf = counts / np.where(words == 0, 1, words)
    idf = np.log(1 + words.mean() / np.maximum(counts.sum(axis=0), 1))
    scores = tf * idf
    out = []
    for row, c in enumerate(ids):
        best = np.argsort(-scores[row], kind="stable")[:top]
        out += [{"cluster_id": c, "term": str(terms[j]), "score": round(float(scores[row, j]), 6),
                 "rank": rank + 1} for rank, j in enumerate(best) if scores[row, j] > 0]
    return out


# ---------------------------------------------------------------------------- data


def load_run(folder: Path) -> dict:
    """One experiment run: ids, labels, membership and (when saved) the clustering space."""
    import pyarrow.parquet as pq

    proj = pq.read_table(folder / "atlas_projection.parquet").to_pydict()
    run = {"ids": proj["occurrence_id"], "labels": np.asarray(proj["cluster_id"]),
           "probabilities": np.asarray(proj["cluster_probability"], dtype=float),
           "x": proj["x"], "y": proj["y"], "space": None}
    space_file = folder / "cluster_space.parquet"
    if space_file.is_file():
        table = pq.read_table(space_file).to_pydict()
        if table["occurrence_id"] == run["ids"]:
            run["space"] = np.asarray(table["space"], dtype=float)
    return run


def load_occurrences(ids: list[str], source: Path | None = None) -> dict[str, dict]:
    """Context and metadata per occurrence id, from the warehouse, or from a parquet snapshot
    (for runs built before the current cleaning)."""
    import duckdb

    wanted = set(ids)
    if source is not None:
        con = duckdb.connect()
        rows = con.execute(f"select occurrence_id, document_id, document_id as title, tradition, "
                           f"symbol_id, '' as matched_term, context from '{source.as_posix()}'").fetchall()
    else:
        con = duckdb.connect(str(pipeline.DATABASE), read_only=True)
        import os
        os.chdir(pipeline.ROOT / "platform")
        rows = con.execute("select o.occurrence_id, o.document_id, d.title, o.tradition, o.symbol_id, "
                           "o.matched_term, o.context from silver.int_symbol_occurrences o "
                           "join silver.int_symbolic_documents d using (document_id)").fetchall()
    con.close()
    keys = ["occurrence_id", "document_id", "title", "tradition", "symbol_id", "matched_term", "context"]
    return {r[0]: dict(zip(keys, r)) for r in rows if r[0] in wanted}


# ---------------------------------------------------------------------------- the review


def analyse(run: dict, occ: dict[str, dict], experiment: str, review_file: dict | None = None) -> dict:
    """Every review artefact for one run, as lists of rows."""
    ids, labels, probs = run["ids"], run["labels"], run["probabilities"]
    meta = [occ[i] for i in ids]
    books = [m["document_id"] for m in meta]
    traditions = [m["tradition"] for m in meta]
    symbols = [m["symbol_id"] for m in meta]
    composition = {r["cluster_id"]: r for r in
                   evaluation.cluster_composition(labels, books, traditions, symbols)}
    reviewed = reviews.by_fingerprint(review_file or {})
    candidates, passages, sym_rows, trad_rows, texts = [], [], [], [], {}
    for c, row in composition.items():
        idx = np.flatnonzero(labels == c)
        member_ids = [ids[i] for i in idx]
        row = {"experiment": experiment, **row,
               "avg_membership_probability": round(float(probs[idx].mean()), 4)}
        paratext_share = round(float(np.mean([looks_like_paratext(meta[i]["context"]) for i in idx])), 4)
        f = flags(row, paratext_share)
        fp = fingerprint(member_ids)
        review = reviewed.get(fp, {})
        candidates.append({**row, "paratext_share": paratext_share,
                           "review_priority_score": review_priority(row), **f,
                           "review_class": review_class(f), "cluster_fingerprint": fp,
                           "review_status": review.get("status", "unreviewed"),
                           "review_label": review.get("label") if review.get("status") == "reviewed" else None})
        if run["space"] is not None:
            ordered, dist = centroid_order(run["space"], idx)
        else:
            ordered, dist = idx[np.argsort(-probs[idx], kind="stable")], np.full(len(idx), np.nan)
        distance = dict(zip(ordered.tolist(), dist.tolist()))
        centroid = ordered[:REPRESENTATIVES].tolist()
        diverse = diverse_representatives(ordered.tolist(), books, probs)
        for kind, chosen in (("centroid", centroid), ("diverse", diverse)):
            for rank, i in enumerate(chosen, start=1):
                m = meta[i]
                passages.append({"experiment": experiment, "cluster_id": c, "representative_set": kind,
                                 "rank": rank, "occurrence_id": ids[i],
                                 "distance_to_centroid": round(distance[i], 5) if not math.isnan(distance[i]) else None,
                                 "document_id": m["document_id"], "title": m["title"],
                                 "tradition": m["tradition"], "symbol_id": m["symbol_id"],
                                 "matched_term": m["matched_term"], "context": m["context"],
                                 "cluster_probability": round(float(probs[i]), 4)})
        for name, values, out in (("symbol_id", symbols, sym_rows), ("tradition", traditions, trad_rows)):
            counts = Counter(values[i] for i in idx)
            out += [{"experiment": experiment, "cluster_id": c, name: k, "occurrence_count": n,
                     "share": round(n / len(idx), 4)} for k, n in counts.most_common()]
        texts[c] = [meta[i]["context"] for i in idx]
    keywords = [{"experiment": experiment, **k} for k in ctfidf(texts)] if texts else []
    top_terms: dict[int, list[str]] = {}
    for k in keywords:
        top_terms.setdefault(k["cluster_id"], []).append(k["term"])
    for row in candidates:
        # Suggestions for the reviewer only: never shown as a label.
        row["suggested_terms"] = ", ".join(top_terms.get(row["cluster_id"], [])[:6])
    candidates.sort(key=lambda r: (-r["review_priority_score"], r["cluster_id"]))
    return {"candidates": candidates, "passages": passages, "keywords": keywords,
            "symbols": sym_rows, "traditions": trad_rows}


def summary(result: dict, experiment: str, top: int = 10) -> dict:
    rows = result["candidates"]
    status = Counter(r["review_status"] for r in rows)
    return {
        "experiment": experiment,
        "cluster_count": len(rows),
        "candidate_cluster_count": sum(r["review_class"] == "candidate" for r in rows),
        "warning_cluster_count": sum(r["review_class"] == "warning" for r in rows),
        "rejected_by_flags_count": sum(r["review_class"] == "reject" for r in rows),
        "reviewed_cluster_count": status.get("reviewed", 0),
        "rejected_cluster_count": status.get("rejected", 0),
        "suspected_paratext_count": sum(r["suspected_paratext"] for r in rows),
        "cross_book_cluster_count": sum(r["cross_book_cluster"] for r in rows),
        "weights": WEIGHTS,
        "thresholds": {"min_size": MIN_SIZE, "min_membership": MIN_MEMBERSHIP,
                       "paratext_share": PARATEXT_SHARE},
        "top_review_priority": [
            {k: r[k] for k in ("cluster_id", "cluster_fingerprint", "review_priority_score",
                               "review_class", "occurrence_count", "book_count", "tradition_count",
                               "symbol_count", "largest_book_share", "suggested_terms")}
            for r in rows if r["review_class"] == "candidate"][:top],
    }


def paratext_clusters(folder: Path, source: Path | None) -> dict:
    """Cluster count, suspected-paratext clusters and their share of occurrences for one run."""
    run = load_run(folder)
    occ = load_occurrences(run["ids"], source)
    labels = run["labels"]
    clusters = sorted(set(int(c) for c in labels) - {-1})
    suspect = []
    for c in clusters:
        idx = np.flatnonzero(labels == c)
        share = float(np.mean([looks_like_paratext(occ[run["ids"][i]]["context"]) for i in idx]))
        if share >= PARATEXT_SHARE:
            suspect.append({"cluster_id": c, "occurrence_count": int(len(idx)), "paratext_share": round(share, 3)})
    return {"clusters": len(clusters), "suspected_paratext_clusters": len(suspect),
            "suspected_paratext_occurrence_share": round(sum(s["occurrence_count"] for s in suspect) / len(labels), 4),
            "suspected": suspect}


def post_cleaning_comparison(before: Path = BEFORE_CLEANING, after: Path = EXPERIMENTS,
                             snapshot: Path = pipeline.FEATURES / "occurrences_before_cleaning.parquet") -> dict | None:
    """Each experiment's metrics before and after the paratext cleaning, side by side, and the
    suspected paratext clusters in each. None when no archived run exists."""
    if not (before / "comparison.json").is_file() or not (after / "comparison.json").is_file():
        return None
    old = {r["experiment"]: r for r in json.loads((before / "comparison.json").read_text())["experiments"]}
    new = {r["experiment"]: r for r in json.loads((after / "comparison.json").read_text())["experiments"]}
    keys = ["occurrences", "clusters", "noise_share", "trustworthiness", "silhouette",
            "mean_largest_book_share", "mean_largest_tradition_share", "mean_largest_symbol_share",
            "mean_book_entropy", "mean_tradition_entropy", "mean_symbol_entropy",
            "cross_book_cluster_count", "cross_book_occurrence_share"]
    out = {"note": "Same UMAP and HDBSCAN parameters; only the document cleaning changed. Aggregate "
                   "metrics alone do not show an improvement: read the representatives.",
           "experiments": {}}
    for name in sorted(set(old) & set(new)):
        entry = {k: {"before": old[name].get(k), "after": new[name].get(k)} for k in keys}
        if snapshot.is_file() and (before / name / "atlas_projection.parquet").is_file():
            entry["paratext"] = {"before": paratext_clusters(before / name, snapshot),
                                 "after": paratext_clusters(after / name, None)}
        out["experiments"][name] = entry
    return out


def write_parquet(path: Path, rows: list[dict]) -> None:
    import pyarrow as pa
    import pyarrow.parquet as pq

    path.parent.mkdir(parents=True, exist_ok=True)
    pq.write_table(pa.Table.from_pylist(rows), path)


def main(experiment: str = "book_centered") -> int:
    folder = EXPERIMENTS / experiment
    run = load_run(folder)
    occ = load_occurrences(run["ids"])
    missing = [i for i in run["ids"] if i not in occ]
    if missing:
        raise SystemExit(f"{len(missing)} occurrences of {experiment} are not in the warehouse: "
                         "rerun the experiment after rebuilding silver.")
    review_file = reviews.load()
    result = analyse(run, occ, experiment, review_file)
    REVIEW.mkdir(parents=True, exist_ok=True)
    write_parquet(REVIEW / "cluster_candidates.parquet", result["candidates"])
    write_parquet(REVIEW / "representative_passages.parquet", result["passages"])
    write_parquet(REVIEW / "cluster_keywords.parquet", result["keywords"])
    write_parquet(REVIEW / "cluster_symbols.parquet", result["symbols"])
    write_parquet(REVIEW / "cluster_traditions.parquet", result["traditions"])
    s = summary(result, experiment)
    s["stale_reviews"] = reviews.stale(review_file, {r["cluster_fingerprint"] for r in result["candidates"]})
    (REVIEW / "review_summary.json").write_text(json.dumps(s, ensure_ascii=False, indent=2) + "\n",
                                                encoding="utf-8")
    comparison = post_cleaning_comparison()
    if comparison:
        (EXPERIMENTS / "post_cleaning_comparison.json").write_text(
            json.dumps(comparison, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{experiment}: {s['cluster_count']} clusters, {s['candidate_cluster_count']} candidates, "
          f"{s['warning_cluster_count']} warnings, {s['rejected_by_flags_count']} rejected by flags "
          f"({s['suspected_paratext_count']} suspected paratext), {s['reviewed_cluster_count']} reviewed")
    for r in s["top_review_priority"][:5]:
        print(f"  cluster {r['cluster_id']:>3} score {r['review_priority_score']:.3f} "
              f"books {r['book_count']} terms: {r['suggested_terms']}")
    return 0


if __name__ == "__main__":
    sys.exit(main(*sys.argv[1:2]))
