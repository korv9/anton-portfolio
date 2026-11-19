"""Ingest lanes: the parallel ingest jobs of .github/workflows/build-warehouse.yml.

A lane is the subjects whose ingest steps run in one job. That job pulls their raw and feature
files, runs their ingest steps, and pushes the files back even when a step failed or timed out.
The next run then reuses what was already fetched. Subjects that write the same raw source (the first
path segment, such as scb or riksdagen) share that source's _manifest.jsonl and pruned folders,
so they share a lane. platform/tests/architecture/test_pipeline_lanes.py checks this.

Subjects without `lane` ingest in the build job itself: news restores the published release into
the checkout, and quality reads the built warehouse.

Each lane job writes ingest-<lane>.json, {subject: null | error}. The build job reads every file.
A lane subject whose ingest failed, or whose file is missing because the job was cancelled,
counts as failed, so `needs` and the publish rules stop what depends on it.
"""
from __future__ import annotations

import json
from pathlib import Path

DEFAULT_TIMEOUT = 70  # minutes for a lane's ingest step; the job allows 20 more for setup and push


def lanes(subjects: dict) -> dict[str, list[str]]:
    found: dict[str, list[str]] = {}
    for name, subject in subjects.items():
        if subject.get("lane") and not subject.get("manual"):
            found.setdefault(subject["lane"], []).append(name)
    return found


def matrix(subjects: dict) -> list[dict]:
    """One entry per lane for the workflow's matrix: its subjects, the ingest step's timeout, and
    the job's (20 minutes more, so the push after a timed-out ingest still runs)."""
    entries = []
    for lane, names in lanes(subjects).items():
        timeout = max(subjects[n].get("ingest_timeout", DEFAULT_TIMEOUT) for n in names)
        entries.append({"lane": lane, "subjects": " ".join(names), "timeout": timeout,
                        "job_timeout": timeout + 20})
    return entries


def write_results(path: Path, names: list[str], failed: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({n: failed.get(n) for n in names}, indent=1), encoding="utf-8")


def read_results(directory: Path, subjects: dict) -> dict[str, str | None]:
    """{subject: None when its lane ingested it, else the reason} for every lane subject."""
    outcome: dict[str, str | None] = {}
    for lane, names in lanes(subjects).items():
        path = directory / f"ingest-{lane}.json"
        try:
            recorded = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            recorded = {}
        for name in names:
            if name not in recorded:
                outcome[name] = f"lane {lane} left no ingest result (cancelled or timed out)"
            elif recorded[name]:
                outcome[name] = f"ingest in lane {lane}: {recorded[name]}"
            else:
                outcome[name] = None
    return outcome
