"""What each run changed and how its tests went, kept beside the warehouse.

Sensor: after the ingest, each subject's raw sources' fetch logs say what this run fetched. A line
names its run (`run_id`) and subject (rawstore.lineage), so the build counts, per subject, the
files whose bytes changed, the ones the server answered 304 for, the ones refetched unchanged,
and the failed requests, including the lanes' fetches, whose logs it pulls. The counts go to the
log and the step summary. Nothing is skipped on them: the build rebuilds the warehouse from the
raw files every run, and an unchanged release uploads nothing (portfolio.publish.release).

DQ history: after every dbt step, its test results (run_results.json) are written as one JSON
line per test under features/quality/dq_results/<subject>/, one file per run and step. They are
stored with the feature files and read by the quality model stg_dq_results, so a test's history
across runs can be queried in the warehouse.
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path

from portfolio.storage import rawstore

DQ = "quality/dq_results"
STATUSES = ("pass", "fail", "warn", "error", "skipped")


def run_id() -> str:
    return os.environ.get("GITHUB_RUN_ID") or "local"


def sensor(name: str, raw: list[str], run: str | None = None) -> dict[str, int]:
    """This run's fetches by `name` in the fetch logs of its raw sources."""
    run = run or run_id()
    counts = {"changed": 0, "not_modified": 0, "unchanged": 0, "failed": 0}
    for source in dict.fromkeys(path.split("/")[0] for path in raw):
        log = rawstore.RAW / source / "_manifest.jsonl"
        if not log.is_file():
            continue
        with log.open(encoding="utf-8") as lines:
            for line in lines:
                if f'"{run}"' not in line:  # cheap filter before parsing a long log
                    continue
                try:
                    record = json.loads(line)
                except ValueError:
                    continue
                if record.get("run_id") != run or record.get("subject") != name:
                    continue
                key = ("failed" if record.get("error") else "not_modified" if record.get("not_modified")
                       else "changed" if record.get("changed") else "unchanged")
                counts[key] += 1
    return counts


def report(rows: dict[str, dict[str, int]]) -> str:
    """A Markdown table of sensor counts, for the log and $GITHUB_STEP_SUMMARY."""
    lines = ["| subject | changed | not modified (304) | refetched unchanged | failed |",
             "|---|---:|---:|---:|---:|"]
    lines += [f"| {name} | {c['changed']} | {c['not_modified']} | {c['unchanged']} | {c['failed']} |"
              for name, c in rows.items()]
    return "\n".join(lines)


def write_summary(text: str) -> None:
    if path := os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(path, "a", encoding="utf-8") as summary:
            summary.write(text + "\n")


def record_dq(features: Path, subject: str, target_dir: Path, step: int, since: float) -> Path | None:
    """Write the tests of the dbt step that just ran; None when it left no results of its own."""
    results = target_dir / "run_results.json"
    if not results.is_file() or results.stat().st_mtime < since:
        return None  # dbt stopped before writing, or the file is an earlier run's
    found = json.loads(results.read_text(encoding="utf-8"))
    executed = found.get("metadata", {}).get("generated_at")
    run = run_id()
    rows = [{"run_id": run, "subject": subject, "target": target_dir.name, "executed_at": executed,
             "unique_id": r["unique_id"], "status": r["status"], "failures": r.get("failures"),
             "execution_time": r.get("execution_time"), "message": (r.get("message") or "")[:500] or None}
            for r in found.get("results", []) if r.get("unique_id", "").startswith(("test.", "unit_test."))]
    attempt = os.environ.get("GITHUB_RUN_ATTEMPT") or datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S")
    path = features / DQ / subject / f"{run}-{attempt}-{step}.jsonl"
    path.parent.mkdir(parents=True, exist_ok=True)
    # ponytail: one small file per run and step, kept forever; prune by date when the folder grows.
    path.write_text("".join(json.dumps(row, ensure_ascii=False) + "\n" for row in rows),
                    encoding="utf-8", newline="\n")
    return path
