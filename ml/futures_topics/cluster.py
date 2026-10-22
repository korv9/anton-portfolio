"""SWEDEN E topic pilot: embed the pre-registered sample, sweep UMAP + HDBSCAN, select, test
stability and the structure null, as fixed in docs/sweden-futures-topics-preregistration.md.

    python -m ml.futures_topics.cluster          # resumes from the checkpoints under OUT/run

CPU only, one fit at a time. Embeddings are written in shards of SHARD sentences and each UMAP
space is cached, so a stopped run resumes. RUN is <PORTFOLIO_FEATURES>/sweden/futures_topics/run,
so warehouse_store.py pushes the checkpoints with the results. The checkpoints (embeddings/,
umap/, sweep.parquet) sit under RUN/cache/<sample key>, a hash of the sample's sentence ids in
order, so a redrawn sample never reuses another sample's vectors or sweep. Reads
RUN/sample.parquet; writes RUN/labels.parquet (sentence id, cluster, probability) and
RUN/metrics.json, which carries the sample key. With no eligible configuration it writes
metrics.json with passes false and exits non-zero.
"""
from __future__ import annotations

import hashlib
import itertools
import json
import os

os.environ.setdefault("CUDA_VISIBLE_DEVICES", "")
# The embedding model is only loaded for missing shards; keep TensorFlow out of the UMAP fits.
os.environ.setdefault("USE_TF", "0")
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "3")

from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.metrics import adjusted_mutual_info_score, adjusted_rand_score, silhouette_score

from ml.futures_topics.sentences import RUN, SEED
from ml.jobs.embeddings import DEFAULT_MODEL, REPRESENTATION, encode_text_batch
from ml.jobs.sweep import REVISION

SHARD = 2000
NEIGHBOURS = (15, 30, 50)
SEEDS = (1, 2, 3)
SIZES = (0.005, 0.01, 0.02)
SAMPLES = (5, 10)
KS = (8, 12, 16, 24, 32)
SUBSAMPLE_SEEDS = (11, 12, 13)


def sample_key(frame: pd.DataFrame) -> str:
    return hashlib.sha1("\n".join(frame.sentence_id).encode()).hexdigest()[:16]


def cache(frame: pd.DataFrame) -> Path:
    return RUN / "cache" / sample_key(frame)


def embeddings(frame: pd.DataFrame) -> np.ndarray:
    from sentence_transformers import SentenceTransformer
    folder = cache(frame) / "embeddings"
    folder.mkdir(parents=True, exist_ok=True)
    model = None
    parts = []
    for start in range(0, len(frame), SHARD):
        path = folder / f"{start:07d}.npy"
        if not path.exists():
            model = model or SentenceTransformer(DEFAULT_MODEL, revision=REVISION, device="cpu")
            vectors = encode_text_batch(model, frame.sentence.iloc[start:start + SHARD].tolist())
            np.save(path.with_suffix(".tmp.npy"), vectors)
            path.with_suffix(".tmp.npy").replace(path)
            print(f"embedded {min(start + SHARD, len(frame)):,}/{len(frame):,}", flush=True)
        parts.append(np.load(path))
    return np.concatenate(parts)


def centre(vectors: np.ndarray, corpus: np.ndarray) -> np.ndarray:
    out = vectors.copy()
    for c in np.unique(corpus):
        out[corpus == c] -= out[corpus == c].mean(axis=0)
    return out / np.maximum(np.linalg.norm(out, axis=1, keepdims=True), 1e-12)


def space(folder: Path, vectors: np.ndarray, neighbours: int, seed: int, name: str) -> np.ndarray:
    import umap
    path = folder / "umap" / f"{name}-n{neighbours}-s{seed}.npy"
    if path.exists():
        return np.load(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    reduced = umap.UMAP(n_components=5, n_neighbors=neighbours, min_dist=0.0, metric="cosine",
                        random_state=seed, low_memory=True).fit_transform(vectors).astype("float32")
    np.save(path, reduced)
    print(f"umap {path.stem}", flush=True)
    return reduced


def hdbscan_fit(reduced: np.ndarray, size: float, samples: int):
    import hdbscan
    # gen_min_span_tree is what makes relative_validity_ (DBCV) available.
    model = hdbscan.HDBSCAN(min_cluster_size=max(2, round(size * len(reduced))), min_samples=samples,
                            cluster_selection_method="eom", gen_min_span_tree=True).fit(reduced)
    return model.labels_, model.probabilities_, float(model.relative_validity_)


def silhouette(points: np.ndarray, labels: np.ndarray) -> float | None:
    keep = np.flatnonzero(labels >= 0)
    keep = np.random.default_rng(SEED).choice(keep, min(10000, len(keep)), replace=False)
    return float(silhouette_score(points[keep], labels[keep])) if len(set(labels[keep])) > 1 else None


def ari(a: np.ndarray, b: np.ndarray) -> float:
    both = (a >= 0) & (b >= 0)
    return float(adjusted_rand_score(a[both], b[both]))


def best_jaccard(a: np.ndarray, b: np.ndarray) -> dict[int, float]:
    """For each cluster of a, its best Jaccard overlap with a cluster of b."""
    out = {}
    for c in np.unique(a[a >= 0]):
        x = a == c
        out[int(c)] = max((float((x & (b == d)).sum() / (x | (b == d)).sum()) for d in np.unique(b[b >= 0])),
                          default=0.0)
    return out


def sweep(folder: Path, vectors: np.ndarray) -> pd.DataFrame:
    path = folder / "sweep.parquet"
    rows = pd.read_parquet(path).to_dict("records") if path.exists() else []
    done = {(r["neighbours"], r["seed"], r["size"], r["samples"]) for r in rows}
    for neighbours, seed in itertools.product(NEIGHBOURS, SEEDS):
        reduced = space(folder, vectors, neighbours, seed, "centred")
        for size, samples in itertools.product(SIZES, SAMPLES):
            if (neighbours, seed, size, samples) in done:
                continue
            labels, _, validity = hdbscan_fit(reduced, size, samples)
            rows.append({"neighbours": neighbours, "seed": seed, "size": size, "samples": samples,
                         "clusters": int(labels.max() + 1), "coverage": float((labels >= 0).mean()),
                         "dbcv": validity, "silhouette": silhouette(reduced, labels)})
            pd.DataFrame(rows).to_parquet(path, index=False)
    return pd.DataFrame(rows)


def main() -> None:
    frame = pd.read_parquet(RUN / "sample.parquet")
    corpus = frame.corpus.to_numpy()
    key, folder = sample_key(frame), cache(frame)
    raw = embeddings(frame)
    vectors = centre(raw, corpus)
    table = sweep(folder, vectors)
    configs = table.groupby(["neighbours", "size", "samples"]).agg(
        dbcv=("dbcv", "mean"), silhouette=("silhouette", "mean"), coverage=("coverage", "mean"),
        clusters=("clusters", "mean")).reset_index()
    eligible = configs[(configs.coverage >= 0.5) & configs.clusters.between(5, 60)]
    if eligible.empty:
        (RUN / "metrics.json").write_text(json.dumps({
            "sample_key": key, "sentences": len(frame), "selected": None, "eligible": 0,
            "stability": {"passes": False}, "null_shuffled_dimensions": {"passes": False},
        }, indent=2) + "\n", encoding="utf-8")
        raise SystemExit("No eligible configuration: no stable topic structure to report")
    chosen = eligible.sort_values("dbcv", ascending=False).iloc[0]
    n, size, samples = int(chosen.neighbours), float(chosen["size"]), int(chosen.samples)
    fits = {s: hdbscan_fit(space(folder, vectors, n, s, "centred"), size, samples) for s in SEEDS}
    labels, probability, _ = fits[1]
    seed_ari = [ari(fits[a][0], fits[b][0]) for a, b in itertools.combinations(SEEDS, 2)]
    jaccard = {c: min(best_jaccard(labels, fits[s][0]).get(c, 0.0) for s in SEEDS[1:])
               for c in range(labels.max() + 1)}
    sub_ari = []
    for s in SUBSAMPLE_SEEDS:
        keep = np.sort(np.random.default_rng(s).choice(len(frame), int(0.8 * len(frame)), replace=False))
        sub = hdbscan_fit(space(folder, vectors[keep], n, 1, f"sub{s}"), size, samples)[0]
        sub_ari.append(ari(labels[keep], sub))
    rng = np.random.default_rng(SEED)
    shuffled = np.stack([rng.permutation(col) for col in vectors.T], axis=1)
    null_labels, _, null_dbcv = hdbscan_fit(space(folder, shuffled, n, 1, "null"), size, samples)
    null_big = int(sum((null_labels == c).mean() > 0.01 for c in range(null_labels.max() + 1)))
    real_big = int(sum((labels == c).mean() > 0.01 for c in range(labels.max() + 1)))
    raw_labels = hdbscan_fit(space(folder, raw, n, 1, "raw"), size, samples)[0]
    reduced = space(folder, vectors, n, 1, "centred")
    real_dbcv = float(table[(table.neighbours == n) & (table["size"] == size)
                            & (table.samples == samples) & (table.seed == 1)].dbcv.iloc[0])
    baseline = []
    from sklearn.cluster import KMeans
    from sklearn.decomposition import PCA
    from sklearn.mixture import GaussianMixture
    pca = PCA(50, random_state=1).fit_transform(vectors)
    for k in KS:
        for name, fit in (("kmeans", lambda: KMeans(k, n_init=4, random_state=1).fit_predict(pca)),
                          ("gmm", lambda: GaussianMixture(k, covariance_type="diag", random_state=1).fit(pca).predict(pca))):
            b = fit()
            baseline.append({"method": name, "k": k, "silhouette_pca": silhouette(pca, b),
                             "ari_vs_hdbscan": ari(labels, b),
                             "corpus_ami": float(adjusted_mutual_info_score(corpus, b))})
    assigned = labels >= 0
    metrics = {
        "model": DEFAULT_MODEL, "revision": REVISION, "representation": REPRESENTATION, "seed": SEED,
        "sample_key": key, "sentences": len(frame), "space": "corpus-centred, re-normalised",
        "selected": {"neighbours": n, "min_cluster_size_fraction": size, "min_samples": samples,
                     "min_cluster_size": max(2, round(size * len(frame))), **{k: float(chosen[k]) for k in
                     ("dbcv", "silhouette", "coverage", "clusters")}},
        "stability": {"seed_ari": seed_ari, "seed_ari_mean": float(np.mean(seed_ari)),
                      "subsample_ari": sub_ari, "subsample_ari_mean": float(np.mean(sub_ari)),
                      "cluster_jaccard_min_over_seeds": jaccard,
                      "passes": bool(np.mean(seed_ari) >= 0.6 and np.mean(sub_ari) >= 0.5)},
        "null_shuffled_dimensions": {"dbcv": null_dbcv, "real_dbcv": real_dbcv,
                                     "clusters": int(null_labels.max() + 1), "clusters_over_1pct": null_big,
                                     "coverage": float((null_labels >= 0).mean()),
                                     "real_clusters_over_1pct": real_big,
                                     "passes": bool(real_dbcv > null_dbcv and real_big > 1)},
        "corpus_ami": {"centred": float(adjusted_mutual_info_score(corpus[assigned], labels[assigned])),
                       "uncentred": float(adjusted_mutual_info_score(corpus[raw_labels >= 0], raw_labels[raw_labels >= 0])),
                       "uncentred_clusters": int(raw_labels.max() + 1),
                       "ari_centred_vs_uncentred": ari(labels, raw_labels)},
        "baseline": baseline, "silhouette_umap_selected": silhouette(reduced, labels),
    }
    pd.DataFrame({"sentence_id": frame.sentence_id, "cluster": labels, "probability": probability}).to_parquet(
        RUN / "labels.parquet", index=False)
    (RUN / "metrics.json").write_text(json.dumps(metrics, indent=2, default=float) + "\n", encoding="utf-8")
    print(json.dumps({k: metrics[k] for k in ("selected", "stability", "null_shuffled_dimensions", "corpus_ami")},
                     indent=1, default=float)[:3000])


if __name__ == "__main__":
    main()
