"""What a release was validated against: dbt results of the group's subjects and file row counts.

The group's subjects come from platform/pipeline.yml (`group:`); each subject's dbt build writes
platform/target/<target>/run_results.json. A failing, erroring or skipped node blocks the release,
as it blocks the export in pipeline.py. No results file means the gate did not run: that is
recorded as not_run, never as a pass.
"""
from __future__ import annotations

import json
from pathlib import Path

import yaml

from portfolio.core.config import PLATFORM
TARGET = PLATFORM / "target"
BLOCKING = ("fail", "error", "skipped")


def targets(group: str) -> list[str]:
    """dbt target directories of the subjects that deliver into the group, in pipeline order."""
    subjects = yaml.safe_load((PLATFORM / "pipeline.yml").read_text(encoding="utf-8"))["subjects"]
    return list(dict.fromkeys(
        subject.get("target", name) for name, subject in subjects.items()
        if subject.get("group") == group and any("dbt" in step for step in subject["steps"])))


def summarise(path: Path) -> dict:
    """One dbt invocation: test counts and the nodes that block or warn."""
    if not path.is_file():
        return {"status": "not_run", "reason": "no run_results.json"}
    run = json.loads(path.read_text(encoding="utf-8"))
    command = run.get("args", {}).get("which")
    if command not in ("build", "test"):
        return {"status": "not_run", "reason": f"last dbt command was {command}, not build or test"}
    tests = {"pass": 0, "warn": 0, "error": 0, "skip": 0}
    failing, warnings = [], []
    for result in run["results"]:
        status, node = result["status"], result["unique_id"]
        if status in BLOCKING:
            failing.append(node)
        elif status == "warn":
            warnings.append(node)
        if node.startswith("test."):
            key = {"fail": "error", "skipped": "skip", "success": "pass"}.get(status, status)
            tests[key] = tests.get(key, 0) + 1
    return {"status": "error" if failing else "warn" if warnings else "pass",
            "generated_at": run.get("metadata", {}).get("generated_at"),
            "invocation_id": run.get("metadata", {}).get("invocation_id"),
            "tests": tests, "failing": sorted(failing), "warnings": sorted(warnings)}


def dq(group: str) -> dict:
    """The group's dbt gate. Only the last dbt step of a subject leaves a run_results.json."""
    names = targets(group)
    if not names:
        return {"status": "not_run", "reason": "no subject in pipeline.yml builds dbt models for this group"}
    subjects = {name: summarise(TARGET / name / "run_results.json") for name in names}
    ran = [s["status"] for s in subjects.values() if s["status"] != "not_run"]
    if not ran:
        return {"status": "not_run", "reason": "no dbt run_results.json for this group at release time",
                "subjects": subjects}
    status = "error" if "error" in ran else "warn" if "warn" in ran else "pass"
    return {"status": status, "scope": "dbt build of each subject in the group", "subjects": subjects}


def rows(path: str, value) -> int | None:
    """Rows of a tabular file: a JSON array, a JSON object's `rows` or `data` array, or Parquet."""
    if path.endswith(".parquet"):
        import pyarrow as pa
        import pyarrow.parquet as pq
        return pq.ParquetFile(pa.BufferReader(value)).metadata.num_rows
    if isinstance(value, dict):
        value = next((value[k] for k in ("rows", "data") if isinstance(value.get(k), list)), None)
    return len(value) if isinstance(value, list) else None


def reconcile(payloads: dict[str, bytes]) -> dict:
    """Row counts per published file. Where an exporter recorded the source table's count beside a
    published path (welfare/datasets.json: {table, path, rows}), the published count must equal it."""
    values = {p: json.loads(d) if p.endswith(".json") else d
              for p, d in payloads.items() if p.endswith((".json", ".parquet"))}
    counts = {p: n for p, v in values.items() if (n := rows(p, v)) is not None}
    checks = {}
    for path, value in values.items():
        for entry in value if isinstance(value, list) else []:
            if isinstance(entry, dict) and isinstance(entry.get("rows"), int) and entry.get("path") in counts:
                checks[entry["path"]] = {"source": f"{path}#{entry.get('table', entry['path'])}",
                                         "expected": entry["rows"], "published": counts[entry["path"]],
                                         "match": entry["rows"] == counts[entry["path"]]}
    return {"status": "mismatch" if any(not c["match"] for c in checks.values())
            else "match" if checks else "counts_only", "rows": counts, "checks": checks}


def gate(group: str, payloads: dict[str, bytes]) -> tuple[dict, dict]:
    """The manifest's `dq` and `reconcile`; raises before upload when either blocks."""
    quality, counts = dq(group), reconcile(payloads)
    if quality["status"] == "error":
        failing = sorted({n for s in quality["subjects"].values() for n in s.get("failing", [])})
        raise ValueError(f"dbt gate blocks {group}: {', '.join(failing[:10])}")
    if counts["status"] == "mismatch":
        bad = [p for p, c in counts["checks"].items() if not c["match"]]
        raise ValueError(f"Row reconciliation failed for {group}: {', '.join(bad)}")
    return quality, counts
