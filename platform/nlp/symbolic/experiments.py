"""Deconfounding experiments on the Symbolic Atlas: are the clusters about symbols, or books?

    python platform/nlp/symbolic/experiments.py

The baseline clusters follow books (style, era, translator) far more than symbols. This runs
the same occurrence sample through four variants and measures how book-, tradition- and
symbol-bound the clusters are in each:

    baseline              original contexts                       (the published atlas)
    masked                the matched word replaced by [SYMBOL]
    book_centered         original embeddings minus their book's mean, re-normalised
    masked_book_centered  both

Embeddings are computed twice, not four times: original contexts serve baseline and
book_centered, masked contexts serve masked and masked_book_centered. Each variant then gets
its own UMAP map, 10-D UMAP space and HDBSCAN clusters with the pipeline's parameters.

Writes warehouse/features/symbolic/experiments/<name>/ (atlas_projection.parquet,
cluster_space.parquet (the 10-D clustering space, local only), evaluation.json, run.json,
cluster_composition.parquet, cluster_representatives.parquet) and
experiments/comparison.json and .parquet, one row per experiment. The root-level artefacts of
pipeline.py, which the site's atlas is built from, are not touched.

    python platform/nlp/symbolic/experiments.py --archive v2-before-cleaning [names…]

first copies the current results to experiments/history/<label>/, so a rerun (after a change
to the cleaning, say) never overwrites the results it is compared with.

    python platform/nlp/symbolic/experiments.py --models [baseline book_centered]

runs the named experiments once per embedding model in MODELS, on the same sample, into
experiments/models/<model>/, and writes experiments/models/comparison.json with one row per
model and experiment (plus the embedding time). The published atlas is not touched.
"""
from __future__ import annotations

import hashlib
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import clustering  # noqa: E402
import embeddings  # noqa: E402
import evaluation  # noqa: E402
import pipeline  # noqa: E402
from transforms import center_by_document, mask_symbol  # noqa: E402

OUT = pipeline.FEATURES / "experiments"
TOP_REPRESENTATIVES = 15
EXPERIMENTS = {
    "baseline": {"masking": False, "centering": False},
    "masked": {"masking": True, "centering": False},
    "book_centered": {"masking": False, "centering": True},
    "masked_book_centered": {"masking": True, "centering": True},
}
MODELS = [embeddings.MODEL, "BAAI/bge-base-en-v1.5", "intfloat/e5-base-v2", "thenlper/gte-base"]
COLUMNS = "occurrence_id, context, document_id, symbol_id, tradition, matched_term"


def sample_hash(ids: list[str]) -> str:
    """SHA-256 of the ordered occurrence ids: equal in every run.json means the same sample."""
    return hashlib.sha256("\n".join(ids).encode()).hexdigest()


def load_sample(database: Path = pipeline.DATABASE) -> dict:
    rows = pipeline.sample(database, columns=COLUMNS)
    pipeline.check_size(len(rows))
    keys = ["ids", "contexts", "documents", "symbols", "traditions", "terms"]
    return dict(zip(keys, (list(col) for col in zip(*rows))))


def inputs(data: dict, masking: bool) -> list[str]:
    if not masking:
        return data["contexts"]
    return [mask_symbol(c, t) for c, t in zip(data["contexts"], data["terms"])]


def write_parquet(path: Path, rows: list[dict]) -> None:
    import pyarrow as pa
    import pyarrow.parquet as pq

    pq.write_table(pa.Table.from_pylist(rows), path)


def write_space(path: Path, ids: list[str], space: np.ndarray) -> None:
    """The 10-D UMAP space HDBSCAN clustered, for review (rank_clusters.py). Local only: it is a
    reduction of the embeddings and is never delivered to the site."""
    import pyarrow as pa
    import pyarrow.parquet as pq

    pq.write_table(pa.table({"occurrence_id": pa.array(ids, pa.string()),
                             "space": pa.FixedSizeListArray.from_arrays(
                                 pa.array(space.reshape(-1), pa.float32()), space.shape[1])}), path)


def run_experiment(name: str, config: dict, data: dict, vectors: np.ndarray, texts: list[str],
                   sample_id: str, out: Path = OUT, model: str = embeddings.MODEL) -> dict:
    started = time.monotonic()
    space_in = center_by_document(vectors, data["documents"]) if config["centering"] else vectors
    layout = clustering.reduce(space_in, clustering.MAP)
    space = clustering.reduce(space_in, clustering.SPACE)
    labels, probabilities = clustering.cluster(space)
    metrics = evaluation.evaluate(space_in, layout, space, labels, probabilities)
    metrics["composition"] = evaluation.composition(labels, data["documents"], data["symbols"])
    rows = evaluation.cluster_composition(labels, data["documents"], data["traditions"], data["symbols"])
    metrics.update(evaluation.composition_summary(rows, len(labels)))

    folder = out / name
    folder.mkdir(parents=True, exist_ok=True)
    pipeline.write_projection(folder / "atlas_projection.parquet", data["ids"], layout, labels, probabilities)
    write_space(folder / "cluster_space.parquet", data["ids"], space)
    write_parquet(folder / "cluster_composition.parquet", [{"experiment": name, **r} for r in rows])
    write_parquet(folder / "cluster_representatives.parquet", [
        {"experiment": name, "cluster_id": c, "rank": rank, "occurrence_id": data["ids"][i],
         "distance_to_centroid": d, "document_id": data["documents"][i], "symbol_id": data["symbols"][i],
         "tradition": data["traditions"][i], "context": texts[i]}
        for c, rank, i, d in evaluation.representatives(space, labels, TOP_REPRESENTATIVES)])
    (folder / "evaluation.json").write_text(json.dumps(metrics, indent=2) + "\n", encoding="utf-8")
    run = {
        "experiment_name": name,
        "embedding_model": model,
        "sample_size": len(data["ids"]),
        "sample_strategy": pipeline.SAMPLE_STRATEGY,
        "sample_sha256": sample_id,
        "masking_enabled": config["masking"],
        "mask_token": "[SYMBOL]" if config["masking"] else None,
        "document_centering_enabled": config["centering"],
        "normalization": "L2 after document centering" if config["centering"] else "L2 (sentence-transformers)",
        "umap_map": clustering.MAP,
        "umap_cluster_space": clustering.SPACE,
        "hdbscan": clustering.HDBSCAN,
        "representatives_per_cluster": TOP_REPRESENTATIVES,
        "timestamp": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "runtime_seconds": round(time.monotonic() - started, 1),
    }
    (folder / "run.json").write_text(json.dumps(run, indent=2) + "\n", encoding="utf-8")
    return metrics


def comparison_row(name: str, m: dict) -> dict:
    keys = ["mean_largest_book_share", "mean_largest_tradition_share", "mean_largest_symbol_share",
            "mean_book_entropy", "mean_tradition_entropy", "mean_symbol_entropy",
            "weighted_mean_largest_book_share", "weighted_mean_largest_tradition_share",
            "weighted_mean_largest_symbol_share", "clusters_with_2plus_books",
            "clusters_with_3plus_books", "clusters_with_4plus_books", "clusters_with_2plus_traditions",
            "clusters_with_3plus_traditions", "cross_book_cluster_count", "cross_book_occurrence_share"]
    return {"experiment": name, "occurrences": m["occurrences"], "clusters": m["clusters"],
            "noise_share": m["noise_share"], "trustworthiness": m["trustworthiness"],
            "silhouette": m["silhouette"],
            "median_membership": (m["membership_probability"] or {}).get("median"),
            **{k: m[k] for k in keys}}


def archive(label: str) -> Path:
    """Copy the current experiment results (not earlier archives) to experiments/history/<label>/."""
    import shutil

    target = OUT / "history" / label
    if target.exists():
        raise SystemExit(f"{target} exists; choose another label")
    target.mkdir(parents=True)
    for item in OUT.iterdir():
        if item.name == "history":
            continue
        (shutil.copytree if item.is_dir() else shutil.copy2)(item, target / item.name)
    return target


def compare_models(names: list[str]) -> int:
    data = load_sample()
    sample_id = sample_hash(data["ids"])
    groups = {"book": data["documents"], "tradition": data["traditions"], "symbol": data["symbols"]}
    rows = []
    for model in MODELS:
        out = OUT / "models" / model.split("/")[-1]
        out.mkdir(parents=True, exist_ok=True)
        cache: dict[bool, tuple[np.ndarray, list[str], float | None]] = {}
        for name in names:
            config = EXPERIMENTS[name]
            if config["masking"] not in cache:
                texts = inputs(data, config["masking"])
                # Local only, never delivered: the vectors, so a rerun skips the slow part.
                saved = out / f"embeddings{'_masked' if config['masking'] else ''}.npy"
                seconds = None
                if saved.is_file():
                    vectors = np.load(saved)
                else:
                    print(f"{model}: embedding {len(texts)} contexts …", flush=True)
                    started = time.monotonic()
                    vectors = embeddings.embed(texts, model)
                    seconds = round(time.monotonic() - started, 1)
                    np.save(saved, vectors)
                cache[config["masking"]] = (vectors, texts, seconds)
            vectors, texts, seconds = cache[config["masking"]]
            space_in = center_by_document(vectors, data["documents"]) if config["centering"] else vectors
            metrics = run_experiment(name, config, data, vectors, texts, sample_id, out, model)
            near = evaluation.neighbourhood(space_in, groups)
            rows.append({"model": model, "dimensions": int(vectors.shape[1]), "embedding_seconds": seconds,
                         **comparison_row(name, metrics),
                         **{f"neighbours_same_{g}": v["share"] for g, v in near.items()},
                         **{f"chance_same_{g}": v["chance"] for g, v in near.items()}})
            print(f"  {name}: {evaluation.summary(metrics)}; cross-book clusters "
                  f"{metrics['cross_book_cluster_count']}; neighbours {near}", flush=True)
            (OUT / "models" / "comparison.json").write_text(
                json.dumps({"sample_sha256": sample_id, "neighbours": 10, "rows": rows}, indent=2) + "\n",
                encoding="utf-8")
    return 0


def main(names: list[str] | None = None) -> int:
    data = load_sample()
    sample_id = sample_hash(data["ids"])
    print(f"Sample: {len(data['ids'])} occurrences, sha256 {sample_id[:12]}…", flush=True)
    cache: dict[bool, tuple[np.ndarray, list[str]]] = {}
    rows = []
    for name in names or list(EXPERIMENTS):
        config = EXPERIMENTS[name]
        if config["masking"] not in cache:
            texts = inputs(data, config["masking"])
            print(f"Embedding {'masked' if config['masking'] else 'original'} contexts …", flush=True)
            cache[config["masking"]] = (embeddings.embed(texts), texts)
        vectors, texts = cache[config["masking"]]
        print(f"{name}: UMAP and HDBSCAN …", flush=True)
        metrics = run_experiment(name, config, data, vectors, texts, sample_id)
        rows.append(comparison_row(name, metrics))
        print(f"  {evaluation.summary(metrics)}; cross-book clusters {metrics['cross_book_cluster_count']}",
              flush=True)
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "comparison.json").write_text(json.dumps({"sample_sha256": sample_id, "experiments": rows},
                                                    indent=2) + "\n", encoding="utf-8")
    write_parquet(OUT / "comparison.parquet", rows)
    return 0


if __name__ == "__main__":
    args = sys.argv[1:]
    if args[:1] == ["--archive"]:
        print(f"Archived to {archive(args[1])}")
        args = args[2:]
    if args[:1] == ["--models"]:
        sys.exit(compare_models(args[1:] or ["baseline", "book_centered"]))
    sys.exit(main(args or None))
