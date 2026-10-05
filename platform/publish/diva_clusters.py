"""Cluster the topics of Swedish student theses harvested from DiVA (platform/ingest/diva/harvest.py)
and write what the site shows: the clusters, their words, how they grew year by year, the
universities that write most in each, example titles, and a map of a sample of theses.

- Text: title (counted twice) + abstract + keywords, lowercased; Swedish and English stop words out.
- Vectors: TF-IDF on words and word pairs (min 5 theses, max half of them), reduced to 100
  dimensions with truncated SVD and length-normalised (latent semantic analysis).
- Clusters: k-means for k in 8, 12, … 32; the k with the best silhouette (on a sample of 5,000)
  is kept. Each cluster's words are its highest class-based TF-IDF terms.
- Map: the first two SVD components of a sample of at most 3,000 theses.

Reads warehouse/raw/diva/records.jsonl, writes frontend/public/data/diva/clusters.json.

    python platform/publish/diva_clusters.py
"""
from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "warehouse/raw/diva/records.jsonl"
OUT = ROOT / "frontend/public/data/diva/clusters.json"
SEED = 0

STOP = set("""
och att det som en på är av för med till den har de inte om ett han men var jag sig från vi så kan
man när år säger hon under också efter eller nu sin där vid mot ska skulle kommer ut får finns vara
hade alla andra mycket än här då sedan över bara in blir upp även vad få två vill ha många hur mer
dem denna detta dessa dess deras vilka vilken vilket samt genom utan inom mellan både samt hos
studien studie studiens uppsatsen uppsats arbetet arbete syftet syfte resultat resultaten metod
undersöka undersöker undersökning visar visade analys analysen kvalitativ kvantitativ intervjuer
the of and to in a is that for on with as are by this be was it from an at or which were their
study thesis results result aim purpose method methods analysis based using used paper research
findings show shows shown also can has have been between its into these this than more how
""".split())


def text(r: dict) -> str:
    return " ".join([r.get("title") or ""] * 2 + [r.get("abstract") or "", " ".join(r.get("subjects") or [])]).lower()


def top_terms(matrix, labels: np.ndarray, vocab: np.ndarray, n: int = 8) -> dict[int, list[str]]:
    """Class-based TF-IDF: each cluster's terms weighted by how specific they are to it."""
    clusters = sorted(set(labels))
    counts = np.vstack([np.asarray(matrix[labels == c].sum(axis=0)).ravel() for c in clusters])
    tf = counts / np.maximum(counts.sum(axis=1, keepdims=True), 1)
    idf = np.log(1 + counts.sum(axis=1).mean() / np.maximum(counts.sum(axis=0), 1))
    score = tf * idf
    return {c: [str(vocab[i]) for i in np.argsort(-score[k])[:n]] for k, c in enumerate(clusters)}


def cluster(records: list[dict], ks=range(8, 33, 4)) -> dict:
    from sklearn.cluster import KMeans
    from sklearn.decomposition import TruncatedSVD
    from sklearn.feature_extraction.text import CountVectorizer, TfidfTransformer
    from sklearn.metrics import silhouette_score
    from sklearn.preprocessing import Normalizer

    docs = [text(r) for r in records]
    counter = CountVectorizer(
        stop_words=sorted(STOP), ngram_range=(1, 2), min_df=min(5, max(2, len(docs) // 200)), max_df=0.5,
        token_pattern=r"(?u)\b[^\W\d_]{3,}\b",
    )
    counts = counter.fit_transform(docs)
    tfidf = TfidfTransformer(sublinear_tf=True).fit_transform(counts)
    dims = min(100, tfidf.shape[1] - 1, len(docs) - 1)
    svd = TruncatedSVD(n_components=dims, random_state=SEED)
    z = Normalizer().fit_transform(svd.fit_transform(tfidf))

    rng = np.random.default_rng(SEED)
    sample = rng.choice(len(docs), size=min(5000, len(docs)), replace=False)
    scores, fits = {}, {}
    for k in ks:
        if k >= len(docs):
            break
        km = KMeans(n_clusters=k, n_init=5, random_state=SEED).fit(z)
        scores[k] = float(silhouette_score(z[sample], km.labels_[sample]))
        fits[k] = km
    best = max(scores, key=scores.get)
    labels = fits[best].labels_
    words = top_terms(counts, labels, counter.get_feature_names_out())

    years = sorted({r["year"] for r in records if r.get("year")})
    clusters = []
    for c in range(best):
        idx = np.where(labels == c)[0]
        members = [records[i] for i in idx]
        # The theses nearest the cluster centre are its clearest examples.
        centre = fits[best].cluster_centers_[c]
        nearest = idx[np.argsort(-(z[idx] @ centre))[:4]]
        by_year = Counter(r["year"] for r in members if r.get("year"))
        clusters.append({
            "id": int(c),
            "size": int(len(idx)),
            "words": words[c],
            "years": [{"year": y, "n": by_year.get(y, 0)} for y in years],
            "universities": [{"name": n, "n": k} for n, k in Counter(r["publisher"] for r in members if r.get("publisher")).most_common(3)],
            "examples": [records[i]["title"] for i in nearest],
        })
    pick = rng.choice(len(docs), size=min(3000, len(docs)), replace=False)
    points = [{"x": round(float(z[i, 0]), 4), "y": round(float(z[i, 1]), 4), "c": int(labels[i]), "t": records[i]["title"][:120]} for i in pick]
    return {
        "k": int(best),
        "silhouette": {str(k): round(v, 3) for k, v in scores.items()},
        "theses": len(records),
        "vocabulary": int(counts.shape[1]),
        "explained_variance": round(float(svd.explained_variance_ratio_.sum()), 3),
        "years": years,
        "clusters": sorted(clusters, key=lambda c: -c["size"]),
        "points": points,
    }


def main() -> int:
    if not RAW.exists():
        raise SystemExit(f"{RAW.relative_to(ROOT)} is missing: run platform/ingest/diva/harvest.py first")
    records = [json.loads(line) for line in RAW.read_text(encoding="utf-8").splitlines()]
    records = [r for r in records if (r.get("title") or "").strip()]
    out = cluster(records)
    out["method"] = {
        "source": "DiVA (diva-portal.org) over OAI-PMH, Dublin Core, student theses by dc:type",
        "text": "title ×2 + abstract + keywords; Swedish and English stop words removed",
        "vectors": "TF-IDF on words and word pairs, truncated SVD to 100 dimensions, normalised",
        "model": "k-means, k in 8…32 by silhouette on a sample of 5,000; words by class-based TF-IDF",
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"{out['theses']:,} theses, k={out['k']}, silhouette {out['silhouette']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
