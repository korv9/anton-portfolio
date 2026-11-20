"""The job cluster model the near real-time flow assigns with, promoted and rolled back by hand.

    python -m ml.jobs.registry show
    python -m ml.jobs.registry evaluate <run_id>      # the gate, without changing anything
    python -m ml.jobs.registry promote <run_id>       # only if the gate passes
    python -m ml.jobs.registry rollback               # back to the model promoted before

A model is a clustering run of ml.jobs.pipeline: its assignments (warehouse/ml/jobs/runs/<id>/, or the
published points under frontend/public/data/jobs/clusters/<id>/) and the cached embeddings of the
same model and revision. Promotion also writes those reference vectors, with their ids and
labels and no text, to warehouse/features/job_clusters/reference-<run_id>.npz, the model artefact
another host restores from R2 (warehouse_store.py --only features --path job_clusters). New ads are assigned by their k nearest reference ads in embedding space
(cosine), which approximates the run's UMAP and HDBSCAN fit without refitting it. The gate holds out
30 % of the reference ads (a stable hash split) and requires the vote to agree with the run's own
labels at least MIN_AGREEMENT of the time, and every cluster to keep MIN_MEMBERS reference ads.
Training a candidate is ml.jobs.pipeline on its own schedule; nothing here trains or promotes on
its own. The register is ml/jobs/registry.json, committed, so each promotion is reviewed.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

from .embeddings import REPRESENTATION

ROOT = Path(__file__).resolve().parents[2]
REGISTRY = Path(__file__).with_name("registry.json")
CACHE = ROOT / "warehouse/ml/jobs"
PUBLISHED = ROOT / "frontend/public/data/jobs"
ARTEFACTS = ROOT / "warehouse/features/job_clusters"
K = 5
MIN_AGREEMENT = 0.65
MIN_MEMBERS = 20


def load() -> dict:
    return json.loads(REGISTRY.read_text(encoding="utf-8"))


def save(registry: dict) -> None:
    REGISTRY.write_text(json.dumps(registry, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")


def run_config(run_id: str) -> dict:
    report = CACHE / "runs" / run_id / "report.json"
    if report.exists():
        return json.loads(report.read_text(encoding="utf-8"))["config"]
    summary = json.loads((PUBLISHED / "cluster-summary.json").read_text(encoding="utf-8"))
    if summary["run_id"] != run_id:
        raise FileNotFoundError(f"run {run_id}: no report under {CACHE / 'runs'} and not the published run")
    return summary["config"]


def assignments(run_id: str) -> dict[str, int]:
    local = CACHE / "runs" / run_id / "assignments.parquet"
    if local.exists():
        import pyarrow.parquet as pq
        table = pq.read_table(local, columns=["job_id", "cluster_id"]).to_pydict()
        return dict(zip(table["job_id"], table["cluster_id"]))
    shards = sorted((PUBLISHED / "clusters" / run_id).glob("points-*.json"))
    if not shards:
        raise FileNotFoundError(f"run {run_id}: no assignments")
    return {p["id"]: p["cluster"] for f in shards for p in json.loads(f.read_text(encoding="utf-8"))["points"]}


def cache_path(model: str, revision: str | None) -> Path:
    # The same key as embeddings.embed, so the reference and new ads share one cache.
    key = hashlib.sha256(f"{model}@{revision or 'default'}:{REPRESENTATION}".encode()).hexdigest()[:16]
    return CACHE / f"embeddings-{key}.parquet"


def artefact(run_id: str) -> Path:
    return ARTEFACTS / f"reference-{run_id}.npz"


def reference(run_id: str) -> tuple[list[str], np.ndarray, np.ndarray]:
    """Job ids, unit vectors and cluster labels of the run's ads that have a cached embedding,
    from the promoted artefact when it exists.

    The cache holds one row per text version of an ad. The run's inputs.parquet names the version
    it was fitted on; a run without it (older or published-only) keeps only ads with one version,
    since any other choice could pair a label with a vector of a text the run never saw."""
    if artefact(run_id).exists():
        saved = np.load(artefact(run_id))
        return saved["ids"].tolist(), saved["vectors"], saved["labels"]
    import pyarrow.parquet as pq
    config = run_config(run_id)
    labels = assignments(run_id)
    inputs = CACHE / "runs" / run_id / "inputs.parquet"
    fitted = (dict(zip(*pq.read_table(inputs, columns=["job_id", "text_hash"]).to_pydict().values()))
              if inputs.exists() else None)
    table = pq.read_table(cache_path(config["model"], config.get("revision")),
                          columns=["job_id", "text_hash", "embedding"]).to_pydict()
    found: dict[str, dict[str, list]] = {}
    for job_id, text, vector in zip(table["job_id"], table["text_hash"], table["embedding"]):
        if job_id in labels and (fitted is None or fitted.get(job_id) == text):
            found.setdefault(job_id, {}).setdefault(text, vector)
    kept = {j: next(iter(v.values())) for j, v in found.items() if len(v) == 1}
    if len(kept) < len(found):
        print(f"{run_id}: {len(found) - len(kept)} ads have several cached text versions and no record "
              "of the one this run used; left out of the reference", flush=True)
    return list(kept), np.asarray(list(kept.values()), dtype="float32"), np.asarray([labels[j] for j in kept])


def vote(vectors: np.ndarray, ref: np.ndarray, labels: np.ndarray, k: int = K) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Each vector's majority cluster among its k most similar reference ads (ties: the nearest),
    the share of the k that agree, and the similarity to the nearest."""
    sims = vectors @ ref.T
    nearest = np.argsort(-sims, axis=1)[:, :k]
    out, support = [], []
    for row in nearest:
        found = labels[row].tolist()
        best = max(found, key=lambda c: (found.count(c), -found.index(c)))
        out.append(best)
        support.append(found.count(best) / len(found))
    return np.asarray(out), np.asarray(support), sims[np.arange(len(sims)), nearest[:, 0]]


def evaluate(run_id: str) -> dict:
    ids, vectors, labels = reference(run_id)
    if not len(labels):
        return {"run_id": run_id, "passed": False, "reasons": ["no reference ads with a cached embedding"]}
    held = np.asarray([int(hashlib.sha256(i.encode()).hexdigest(), 16) % 10 < 3 for i in ids])
    if held.all() or not held.any():
        return {"run_id": run_id, "passed": False, "reasons": ["the hash split left one side empty"]}
    predicted, _, _ = vote(vectors[held], vectors[~held], labels[~held])
    agreement = float((predicted == labels[held]).mean())
    members = {int(c): int((labels == c).sum()) for c in np.unique(labels)}
    reasons = []
    if agreement < MIN_AGREEMENT:
        reasons.append(f"held-out agreement {agreement:.3f} < {MIN_AGREEMENT}")
    if not any(c >= 0 for c in members):
        reasons.append("no cluster: every reference ad is noise")
    reasons += [f"cluster {c}: {n} reference ads < {MIN_MEMBERS}" for c, n in members.items() if c >= 0 and n < MIN_MEMBERS]
    return {"run_id": run_id, "passed": not reasons, "reasons": reasons, "k": K,
            "held_out_agreement": round(agreement, 4), "held_out": int(held.sum()),
            "reference_ads": len(labels), "members": members,
            "evaluated_at": datetime.now(timezone.utc).isoformat(timespec="seconds")}


def promote(run_id: str) -> dict:
    gate = evaluate(run_id)
    if not gate["passed"]:
        raise SystemExit(f"{run_id} not promoted: " + "; ".join(gate["reasons"]))
    registry = load() if REGISTRY.exists() else {"schema_version": 1, "current": None, "history": []}
    config = run_config(run_id)
    ids, vectors, labels = reference(run_id)
    ARTEFACTS.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(artefact(run_id), ids=np.asarray(ids), vectors=vectors, labels=labels)
    registry["history"].append({"at": gate["evaluated_at"], "action": "promote", "run_id": run_id,
                                "from": registry["current"], "model": config["model"],
                                "revision": config.get("revision"), "gate": gate})
    registry["current"] = run_id
    save(registry)
    return registry


def rollback() -> dict:
    registry = load()
    promoted = [h for h in registry["history"] if h["action"] == "promote"]
    before = [h["run_id"] for h in promoted if h["run_id"] != registry["current"]]
    if not before:
        raise SystemExit("no earlier promoted model to roll back to")
    registry["history"].append({"at": datetime.now(timezone.utc).isoformat(timespec="seconds"), "action": "rollback",
                                "run_id": before[-1], "from": registry["current"]})
    registry["current"] = before[-1]
    save(registry)
    return registry


def current() -> dict:
    """The current model: run id, embedding model and revision."""
    registry = load()
    entry = next(h for h in reversed(registry["history"]) if h["run_id"] == registry["current"] and "model" in h)
    return {"run_id": registry["current"], "model": entry["model"], "revision": entry["revision"]}


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    sub = ap.add_subparsers(dest="command", required=True)
    sub.add_parser("show")
    for name in ("evaluate", "promote"):
        sub.add_parser(name).add_argument("run_id")
    sub.add_parser("rollback")
    args = ap.parse_args()
    if args.command == "show":
        result = load()
    elif args.command == "evaluate":
        result = evaluate(args.run_id)
    else:
        result = promote(args.run_id) if args.command == "promote" else rollback()
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if args.command == "evaluate" and not result["passed"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
