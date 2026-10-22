"""Exploratory, outside the pre-registration: is there stable structure in the futures sentences
under another representation, or once metadata is accounted for?

    python -m ml.feature_study.futures

The registered pilot (docs/sweden-futures-topics-preregistration.md) found none: seed ARI 0.38,
subsample ARI 0.36 (frontend/public/data/sweden/futures/topics.json). This does not replace or
amend it; nothing here is published as topics. Reads the pilot's sample and its MiniLM shards
(PORTFOLIO_FEATURES/sweden/futures_topics/run). Spaces, each reduced to 50 PCA components:
- centred: the registered space (corpus means removed, re-normalised);
- residualised: the centred vectors with corpus x year, log sentence length and marker type
  regressed out, so what is left cannot be those;
- conditioned: the centred PCA components joined with the metadata, scaled to the same total
  variance, so the metadata can steer the clusters.
K-means for k = 8 and 16: seed ARI (seeds 1-3, one start each, the role UMAP seeds play in the
pilot), ARI against refits on 80 % subsamples (seeds 11-13), silhouette on 10,000 sentences
against a null with every component permuted on its own, and AMI with each metadata field.
"""
from __future__ import annotations

import itertools
import os
import re
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
from sklearn.metrics import adjusted_mutual_info_score, adjusted_rand_score, silhouette_score

from ml.feature_study.report import ROOT, standardise, write
from ml.futures_topics.cluster import centre

RUN = Path(os.environ.get("PORTFOLIO_FEATURES", ROOT / "warehouse/features")) / "sweden/futures_topics/run"
# The alternatives of the registered future marker (platform/seeds/sweden_futures/future_terms.csv).
MARKERS = {"future": r"framtid", "generations": r"kommande generationer|våra barn och barnbarn",
           "tomorrow": r"morgondagens", "long_term": r"långsiktig|på lång sikt",
           "horizon": r"om (?:tio|tjugo|trettio|femtio|hundra) år|(?:år|till|fram till|inför) 20[2-9]0\b",
           "vision": r"vision"}
KS, SEEDS, SUBSAMPLES, COMPONENTS, SIL_N, NULL_ROUNDS = (8, 16), (1, 2, 3), (11, 12, 13), 50, 10000, 20


def marker(sentence: str) -> str:
    """The marker alternative that occurs first in the sentence; 'other' if none does."""
    text = sentence.lower()
    hits = {name: m.start() for name, p in MARKERS.items() if (m := re.search(r"\b(?:" + p + ")", text))}
    return min(hits, key=hits.get) if hits else "other"


def metadata(sample: pd.DataFrame) -> pd.DataFrame:
    words = sample.sentence.str.split().str.len()
    return pd.DataFrame({"corpus": sample.corpus.to_numpy(), "year": sample.year.to_numpy(),
                         "log_words": np.log(words.to_numpy(float)), "marker": sample.sentence.map(marker).to_numpy(),
                         "length_quartile": pd.qcut(words, 4, labels=False, duplicates="drop").to_numpy()})


def design(meta: pd.DataFrame) -> np.ndarray:
    """Corpus x year and marker dummies plus centred log length, with an intercept."""
    cells = pd.get_dummies(meta.corpus + ":" + meta.year.astype(str), drop_first=True, dtype=float)
    markers = pd.get_dummies(meta.marker, drop_first=True, dtype=float)
    length = (meta.log_words - meta.log_words.mean()).to_numpy()[:, None]
    return np.hstack([np.ones((len(meta), 1)), cells.to_numpy(), markers.to_numpy(), length])


def residualise(vectors: np.ndarray, x: np.ndarray) -> np.ndarray:
    beta, *_ = np.linalg.lstsq(x, vectors, rcond=None)
    out = vectors - x @ beta
    return out / np.maximum(np.linalg.norm(out, axis=1, keepdims=True), 1e-12)


def condition(reduced: np.ndarray, meta: pd.DataFrame) -> np.ndarray:
    """PCA components plus z-scored metadata, the metadata block scaled to the same total variance."""
    extra = np.hstack([pd.get_dummies(meta[["corpus", "marker"]], dtype=float).to_numpy(),
                       meta[["year", "log_words"]].to_numpy(float)])
    extra = standardise(extra)
    extra *= np.sqrt(reduced.var(axis=0).sum() / max(extra.var(axis=0).sum(), 1e-12))
    return np.hstack([reduced, extra])


def fit(x: np.ndarray, k: int, seed: int) -> np.ndarray:
    return KMeans(k, n_init=1, random_state=seed).fit_predict(x)


def score(x: np.ndarray, k: int, meta: pd.DataFrame) -> dict:
    rng = np.random.default_rng(20261022)
    runs = {s: fit(x, k, s) for s in SEEDS}
    seed_ari = [adjusted_rand_score(runs[a], runs[b]) for a, b in itertools.combinations(SEEDS, 2)]
    subsample_ari = []
    for s in SUBSAMPLES:
        rows = np.random.default_rng(s).choice(len(x), int(0.8 * len(x)), replace=False)
        subsample_ari.append(adjusted_rand_score(runs[SEEDS[0]][rows], fit(x[rows], k, SEEDS[0])))
    probe = rng.choice(len(x), SIL_N, replace=False)
    observed = float(silhouette_score(x[probe], runs[SEEDS[0]][probe]))
    null = []
    for _ in range(NULL_ROUNDS):
        shuffled = np.column_stack([rng.permutation(x[probe, j]) for j in range(x.shape[1])])
        null.append(silhouette_score(shuffled, fit(shuffled, k, SEEDS[0])))
    labels = runs[SEEDS[0]]
    return {"k": k, "seed_ari": [round(v, 4) for v in seed_ari], "seed_ari_mean": round(float(np.mean(seed_ari)), 4),
            "subsample_ari": [round(v, 4) for v in subsample_ari],
            "subsample_ari_mean": round(float(np.mean(subsample_ari)), 4),
            "silhouette": round(observed, 4), "null_95": round(float(np.percentile(null, 95)), 4),
            "null_rounds": NULL_ROUNDS, "largest_share": round(float(np.bincount(labels).max() / len(labels)), 4),
            "ami": {c: round(float(adjusted_mutual_info_score(meta[c].astype(str), labels)), 4)
                    for c in ("corpus", "year", "marker", "length_quartile")}}


def load() -> tuple[pd.DataFrame, np.ndarray]:
    sample = pd.read_parquet(RUN / "sample.parquet")
    shards = sorted((RUN / "embeddings").glob("*.npy"))
    vectors = np.concatenate([np.load(p) for p in shards]).astype(np.float32)
    if len(vectors) != len(sample):
        raise SystemExit(f"{len(vectors)} vectors for {len(sample)} sentences: the shards are not this sample's")
    return sample, vectors


def main() -> None:
    sample, vectors = load()
    meta = metadata(sample)
    centred = centre(vectors, sample.corpus.to_numpy())
    pca = lambda v: PCA(COMPONENTS, random_state=0).fit_transform(v)
    spaces = {"centred": pca(centred)}
    spaces["residualised"] = pca(residualise(centred, design(meta)))
    spaces["conditioned"] = condition(spaces["centred"], meta)
    write("futures", {"sentences": int(len(sample)), "components": COMPONENTS,
                      "markers": meta.marker.value_counts().to_dict(),
                      "registered_result": {"seed_ari_mean": 0.3791, "subsample_ari_mean": 0.3622,
                                            "source": "frontend/public/data/sweden/futures/topics.json"},
                      "spaces": {name: [score(x, k, meta) for k in KS] for name, x in spaces.items()}})


if __name__ == "__main__":
    main()
