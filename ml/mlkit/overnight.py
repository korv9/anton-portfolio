"""Run every model unattended and leave a report to read in the morning.

    python -m mlkit.overnight

Each job is cached on a key built from its config and its inputs, so a rerun that changes
nothing does nothing. A job that fails is recorded and the queue continues, because losing
a whole night to one traceback is the failure mode worth designing against.

Nothing here publishes. Output lands in ml/runs/<run_id>/ and reaches the site only through
an explicit promote.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import time
import traceback
from datetime import datetime, timezone
from pathlib import Path

from mlkit import cards
from mlkit.tasks import policy_area, polarization, seniority

ROOT = Path(__file__).resolve().parents[2]
RUNS = ROOT / "ml/runs"
MIN_FREE_GB = 15

JOBS = [
    ("policy_area", policy_area.run),
    ("polarization", polarization.run),
    ("seniority", seniority.run),
    # sou_map waits for SOU ingestion; adding it here is the only change needed.
]


def device_name() -> str:
    try:
        import torch

        return torch.cuda.get_device_name(0) if torch.cuda.is_available() else "cpu"
    except Exception:
        return "cpu"


def free_gigabytes() -> float:
    return shutil.disk_usage(ROOT).free / 1024 ** 3


def job_key(task: str, result_inputs: dict) -> str:
    payload = json.dumps({"task": task, **result_inputs}, sort_keys=True, default=str)
    return hashlib.sha256(payload.encode()).hexdigest()[:16]


def completed_keys() -> dict[str, Path]:
    """Every job that already finished, from any previous run."""
    done = {}
    for path in sorted(RUNS.glob("*/*/result.json")):
        try:
            done[json.loads(path.read_text(encoding="utf-8"))["key"]] = path
        except (json.JSONDecodeError, KeyError):
            continue
    return done


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--force", action="store_true", help="ignore the cache")
    parser.add_argument("--only", nargs="*", help="run only these tasks")
    parser.add_argument("--cpu", action="store_true", help="force CPU")
    parser.add_argument("--no-transformers", action="store_true",
                        help="skip KB-BERT fine-tuning (hours per job without a GPU); "
                             "jobs whose headline needs it report 'partial' and keep their card")
    arguments = parser.parse_args()

    if free_gigabytes() < MIN_FREE_GB:
        raise SystemExit(f"Only {free_gigabytes():.0f} GB free; need {MIN_FREE_GB} GB. Stopping "
                         "before caches and checkpoints fill the disk.")

    started_at = datetime.now(timezone.utc)
    stamp = started_at.strftime("%Y%m%d-%H%M")
    run_dir = RUNS / stamp
    run_dir.mkdir(parents=True, exist_ok=True)
    device = "cpu" if arguments.cpu else device_name()
    cache = {} if arguments.force else completed_keys()

    print(f"run {stamp} · device {device} · {free_gigabytes():.0f} GB free"
          + (" · transformers skipped" if arguments.no_transformers else ""))
    results, began = [], time.time()

    for task, run in JOBS:
        if arguments.only and task not in arguments.only:
            continue
        job_dir = run_dir / task
        job_dir.mkdir(parents=True, exist_ok=True)
        clock = time.time()
        print(f"\n=== {task} ===", flush=True)
        try:
            result = run(job_dir, device=device, cached=cache, force=arguments.force,
                         transformers=not arguments.no_transformers)
            result = {"task": task, "status": result.pop("status", "ok"), **result}
        except Exception:
            result = {"task": task, "status": "failed", "error": traceback.format_exc()}
            print(f"  failed: {result['error'].splitlines()[-1]}", flush=True)
        result["minutes"] = (time.time() - clock) / 60
        result.setdefault("device", device)
        results.append(result)
        (job_dir / "result.json").write_text(
            json.dumps(result, ensure_ascii=False, indent=1, default=str), encoding="utf-8")

        if result["status"] == "ok" and result.get("card"):
            cards.write_card(task, stamp, result["card"])

    report = cards.write_report(run_dir, results, started_at.isoformat(timespec="minutes"),
                                time.time() - began)
    print(f"\nreport: {report}")


if __name__ == "__main__":
    main()
