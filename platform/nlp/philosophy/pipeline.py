"""The Philosophy Atlas's analytical stage: sample, embed, map, cluster, evaluate, score tensions.

    python platform/nlp/philosophy/pipeline.py

1. A balanced sample: at most PER_DOCUMENT passages per work, evenly spaced through the work,
   so long works (Leviathan, the Republic) do not outnumber short ones (Kant's Groundwork).
2. Embeddings with the shared multilingual model (nlp/text/vectors.py), the same model the
   concept layer uses, so these vectors can be compared with the other corpora's.
3. Two maps, as the Symbolic Atlas learned to do: `baseline` (the embeddings as they are) and
   `author_centered` (each work's mean vector subtracted, nlp/symbolic/transforms.py), which
   removes what makes a work sound like itself (its translator's English, its vocabulary) and
   leaves what varies inside it. UMAP to 2-D for the map and 10-D for HDBSCAN.
4. Evaluation per map: clusters, noise, how far clusters are dominated by one work (largest
   share, normalised entropy), cross-work clusters (at least three works, none above half),
   the share of each passage's ten nearest neighbours that come from the same work, and the
   same for the translator, against what a random neighbour would give.
5. Per cluster: its works and traditions, the passages nearest its centre, and its most
   distinctive words (class-based TF-IDF): material for a person to review, never a label. A
   cluster gets a status and label only from reviewed_clusters.json, keyed by its fingerprint
   (the hash of its sorted members), so a review survives a rerun only if the cluster does.
6. Tension scores: each passage's similarity to the two poles of each tension in
   seeds/philosophy/tensions.csv (a pole is embedded from its anchor sentence); position is
   similarity to pole A minus pole B. A derived reading along a chosen lens, not a measurement
   of what the author holds.

Writes warehouse/features/philosophy/ (atlas.parquet, clusters.parquet, tension_scores.parquet,
run.json); dbt reads them back. No vector is delivered to the site.
"""
from __future__ import annotations

import csv
import hashlib
import json
import os
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import duckdb
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "platform" / "nlp" / "text"))
sys.path.insert(0, str(ROOT / "platform" / "nlp" / "symbolic"))

from vectors import MULTILINGUAL, embed  # noqa: E402

DATABASE = Path(os.environ.get("PORTFOLIO_DB", ROOT / "warehouse/portfolio.duckdb"))
OUT = Path(os.environ.get("PORTFOLIO_FEATURES", ROOT / "warehouse/features")) / "philosophy"
TENSIONS = ROOT / "platform/seeds/philosophy/tensions.csv"
PER_DOCUMENT = 200
NEIGHBOURS = 10
HDBSCAN = {"min_cluster_size": 25, "min_samples": 8, "metric": "euclidean"}
CROSS_MIN_WORKS = 3
CROSS_MAX_SHARE = 0.5
REPRESENTATIVES = 6
TERMS = 10
REVIEWS = Path(__file__).resolve().parent / "reviewed_clusters.json"


def balanced_sample(frame: pd.DataFrame, per_document: int = PER_DOCUMENT) -> pd.DataFrame:
    """At most `per_document` passages per work, evenly spaced through it (deterministic)."""
    parts = []
    for _, group in frame.sort_values(["document_id", "position"]).groupby("document_id"):
        if len(group) <= per_document:
            parts.append(group)
        else:
            idx = np.linspace(0, len(group) - 1, per_document).round().astype(int)
            parts.append(group.iloc[np.unique(idx)])
    return pd.concat(parts, ignore_index=True)


def entropy(counts: list[int]) -> float:
    total = sum(counts)
    if total == 0 or len(counts) < 2:
        return 0.0
    p = np.array(counts) / total
    p = p[p > 0]
    return float(-(p * np.log(p)).sum() / np.log(len(counts)))


def same_neighbour_rate(vectors: np.ndarray, groups: list[str], k: int = NEIGHBOURS) -> float:
    """Share of each passage's k nearest neighbours (cosine) that share its group."""
    sim = vectors @ vectors.T
    np.fill_diagonal(sim, -np.inf)
    nearest = np.argpartition(-sim, k, axis=1)[:, :k]
    g = np.asarray(groups)
    return float((g[nearest] == g[:, None]).mean())


def chance_rate(groups: list[str]) -> float:
    """What the same-group rate would be for random neighbours."""
    n = len(groups)
    return float(sum(c * (c - 1) for c in Counter(groups).values()) / (n * (n - 1)))


def ctfidf_terms(texts: list[str], labels: np.ndarray, top: int = TERMS) -> dict[int, list[str]]:
    from sklearn.feature_extraction.text import CountVectorizer

    clusters = sorted(set(labels) - {-1})
    docs = [" ".join(t for t, l in zip(texts, labels) if l == c) for c in clusters]
    if not docs:
        return {}
    vectorizer = CountVectorizer(stop_words="english", min_df=2, token_pattern=r"(?u)\b[a-zA-Z][a-zA-Z]{2,}\b")
    counts = vectorizer.fit_transform(docs).toarray().astype(float)
    tf = counts / counts.sum(axis=1, keepdims=True).clip(min=1)
    idf = np.log(1 + counts.sum(axis=1).mean() / counts.sum(axis=0).clip(min=1))
    scores = tf * idf
    words = np.array(vectorizer.get_feature_names_out())
    return {c: list(words[np.argsort(-scores[i])[:top]]) for i, c in enumerate(clusters)}


def fingerprint(ids: list[str]) -> str:
    """A cluster's identity across runs: the SHA-256 of its sorted member ids (first 16 hex)."""
    return hashlib.sha256("\n".join(sorted(ids)).encode()).hexdigest()[:16]


def evaluate(vectors, labels, works, translators) -> dict:
    clusters = sorted(set(labels) - {-1})
    largest, cross = [], 0
    for c in clusters:
        counts = Counter(w for w, l in zip(works, labels) if l == c)
        share = max(counts.values()) / sum(counts.values())
        largest.append(share)
        cross += len(counts) >= CROSS_MIN_WORKS and share <= CROSS_MAX_SHARE
    known = [i for i, t in enumerate(translators) if t]
    return {
        "clusters": len(clusters),
        "noise_share": float((labels == -1).mean()),
        "mean_largest_work_share": float(np.mean(largest)) if largest else None,
        "work_dominated_clusters": int(sum(s > 0.8 for s in largest)),
        "cross_work_clusters": int(cross),
        "same_work_neighbours": same_neighbour_rate(vectors, works),
        "same_work_chance": chance_rate(works),
        "same_translator_neighbours": same_neighbour_rate(vectors[known], [translators[i] for i in known]),
        "same_translator_chance": chance_rate([translators[i] for i in known]),
    }


def main() -> int:
    from clustering import MAP, SPACE, cluster, reduce
    from transforms import center_by_document

    con = duckdb.connect(str(DATABASE), read_only=True)
    passages = con.sql("""
        select passage_id, document_id, position, text, author, tradition, translator
        from silver.int_philosophy_passages""").df()
    sample = balanced_sample(passages)
    works = sample["document_id"].tolist()
    translators = [t if isinstance(t, str) else "" for t in sample["translator"]]
    print(f"Embedding {len(sample)} passages from {sample.document_id.nunique()} works with {MULTILINGUAL} …", flush=True)
    vectors = embed(sample["text"].tolist())
    variants = {"baseline": vectors, "author_centered": center_by_document(vectors, works)}

    reviews = {r["fingerprint"]: r for r in json.loads(REVIEWS.read_text(encoding="utf-8"))["clusters"]}
    atlas_rows, cluster_rows, evaluation = [], [], {}
    for name, v in variants.items():
        layout, space = reduce(v, MAP), reduce(v, SPACE)
        labels, prob = cluster(space, HDBSCAN)
        evaluation[name] = evaluate(v, labels, works, translators)
        terms = ctfidf_terms(sample["text"].tolist(), labels)
        for i, row in enumerate(sample.itertuples()):
            atlas_rows.append({"variant": name, "passage_id": row.passage_id, "x": float(layout[i, 0]),
                               "y": float(layout[i, 1]), "cluster_id": int(labels[i]),
                               "probability": float(prob[i])})
        for c in sorted(set(labels) - {-1}):
            members = np.where(labels == c)[0]
            centre = space[members].mean(axis=0)
            nearest = members[np.argsort(((space[members] - centre) ** 2).sum(axis=1))[:REPRESENTATIVES]]
            counts = Counter(works[i] for i in members)
            traditions = Counter(sample.iloc[i].tradition for i in members)
            share = max(counts.values()) / len(members)
            fp = fingerprint([sample.iloc[i].passage_id for i in members])
            cluster_rows.append({
                "variant": name, "cluster_id": int(c), "size": int(len(members)),
                "fingerprint": fp,
                "works": json.dumps(dict(counts.most_common())),
                "traditions": json.dumps(dict(traditions.most_common())),
                "work_count": len(counts), "largest_work_share": float(share),
                "work_entropy": entropy(list(counts.values()) + [0] * (len(set(works)) - len(counts))),
                "is_cross_work": bool(len(counts) >= CROSS_MIN_WORKS and share <= CROSS_MAX_SHARE),
                "representatives": json.dumps([sample.iloc[i].passage_id for i in nearest]),
                "distinctive_terms": json.dumps(terms.get(c, [])),
                "review_status": reviews.get(fp, {}).get("status", "unreviewed"),
                "review_label": reviews.get(fp, {}).get("label"),
            })
        print(name, json.dumps(evaluation[name]), flush=True)

    # Tension scores along each lens, on the baseline vectors.
    tensions = list(csv.DictReader(TENSIONS.open(encoding="utf-8")))
    anchors = embed([t["anchor_a"] for t in tensions] + [t["anchor_b"] for t in tensions])
    a_vec, b_vec = anchors[: len(tensions)], anchors[len(tensions):]
    sim_a, sim_b = vectors @ a_vec.T, vectors @ b_vec.T
    tension_rows = [{"passage_id": row.passage_id, "tension_id": t["tension_id"],
                     "similarity_a": float(sim_a[i, j]), "similarity_b": float(sim_b[i, j]),
                     "position": float(sim_a[i, j] - sim_b[i, j])}
                    for i, row in enumerate(sample.itertuples()) for j, t in enumerate(tensions)]

    OUT.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(atlas_rows).to_parquet(OUT / "atlas.parquet", index=False)
    pd.DataFrame(cluster_rows).to_parquet(OUT / "clusters.parquet", index=False)
    pd.DataFrame(tension_rows).to_parquet(OUT / "tension_scores.parquet", index=False)
    np.save(OUT / "embeddings.npy", vectors)
    sample[["passage_id"]].to_parquet(OUT / "embedding_ids.parquet", index=False)
    run = {"model": MULTILINGUAL, "passages_total": int(len(passages)), "passages_sampled": int(len(sample)),
           "per_document": PER_DOCUMENT, "works": int(sample.document_id.nunique()),
           "umap_map": MAP, "umap_space": SPACE, "hdbscan": HDBSCAN, "neighbours": NEIGHBOURS,
           "evaluation": evaluation, "ran_at": datetime.now(timezone.utc).isoformat(timespec="seconds")}
    (OUT / "run.json").write_text(json.dumps(run, indent=1) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
