"""Assign the job assistant's ads to the current job cluster model, embedding only new or changed texts.

    python platform/job_assistant/clusters.py

The model is the run named current in ml/jobs/registry.json (promoted by hand, see ml/jobs/registry.py).
An ad is assigned again only when its content hash or the model changes; its text goes through the
model's own embedding cache (ml/jobs/embeddings.embed, keyed by text hash), so a text already embedded
costs nothing. Writes warehouse/raw/job_assistant/clusters.json:

    model        run id, embedding model and revision
    assignments  per ad id: content hash, text hash, cluster (-1 is noise), the share of the k nearest
                 reference ads that agree, and the similarity to the nearest
    signals      per cluster, the open ads now and those new, changed and removed in this pass
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from ads import load_ads, store_dir, write_atomic  # noqa: E402
from ml.jobs import registry  # noqa: E402
from ml.jobs.prepare import semantic_text, text_hash  # noqa: E402


def update(embed=None) -> dict:
    """Assign what changed since the last pass; returns the pass's counts and embedding use."""
    started = time.monotonic()
    model = registry.current()
    ads = load_ads(store_dir() / "ads.json")
    path = store_dir() / "clusters.json"
    old = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    kept = old.get("assignments", {}) if old.get("model") == model else {}
    todo = {k: a for k, a in ads.items() if not a.get("removed_at")
            and (kept.get(k) or {}).get("content_hash") != a["content_hash"]}
    assignments = {k: v for k, v in kept.items() if k in ads}
    usage = {"texts": len(todo), "new_unique_texts": 0, "reused": 0, "seconds": 0.0}
    if todo:
        import pandas as pd
        texts = {k: semantic_text(a["headline"], a["description"], (a.get("must_have") or []) + (a.get("nice_to_have") or []))
                 for k, a in todo.items()}
        jobs = pd.DataFrame({"job_id": list(texts), "text": list(texts.values())})
        jobs["text_hash"] = jobs.text.map(text_hash)
        if embed is None:
            from ml.jobs.embeddings import embed
        t = time.monotonic()
        vectors, info = embed(jobs, registry.CACHE, model["model"], model["revision"])
        usage.update(new_unique_texts=info["new_unique_texts"], reused=info["reused"],
                     seconds=round(time.monotonic() - t, 2))
        _, ref, labels = registry.reference(model["run_id"])
        cluster, support, nearest = registry.vote(vectors, ref, labels)
        for i, key in enumerate(jobs.job_id):
            assignments[key] = {"content_hash": todo[key]["content_hash"], "text_hash": jobs.text_hash[i],
                                "cluster": int(cluster[i]), "support": round(float(support[i]), 2),
                                "nearest_similarity": round(float(nearest[i]), 4)}
    signals: dict[str, dict] = {}
    was_open = set(old.get("open_ids") or [])
    for key, row in assignments.items():
        ad = ads[key]
        s = signals.setdefault(str(row["cluster"]), {"open": 0, "new": 0, "changed": 0, "removed": 0})
        if ad.get("removed_at"):
            s["removed"] += int(key in was_open)
            continue
        s["open"] += 1
        if key in todo:
            s["new" if key not in old.get("assignments", {}) else "changed"] += 1
    result = {"model": model, "assignments": assignments, "signals": signals,
              "open_ids": sorted(k for k in assignments if not ads[k].get("removed_at"))}
    write_atomic(path, result)
    usage["seconds_total"] = round(time.monotonic() - started, 2)
    return {"model": model["run_id"], "assigned": len(todo), "embedding": usage, "signals": signals}


if __name__ == "__main__":
    print(json.dumps(update(), ensure_ascii=False))
