"""What a release was validated against: dbt results of the group's subjects and file row counts.

The group's subjects come from platform/pipeline.yml (`group:`); each subject's dbt build writes
platform/target/<target>/run_results.json. A failing, erroring or skipped node blocks the release,
as it blocks the export in pipeline.py. No results file means the gate did not run: that is
recorded as not_run, never as a pass. When some of the group's subjects ran, a missing one blocks
unless pipeline.yml marks it manual (left out of --all, so its absence is expected).

The row counts are also compared with the active release: losing a large share of a file's rows
blocks the release, unless PORTFOLIO_ALLOW_ROW_DROP names the file (comma-separated logical paths).
A delivery spec's `count_rows` names small files that are checked at any size, each with the keys of
the lists inside a row that are counted instead of the rows ([] counts the rows): a top list of
two periods counts its employers, a term file its rising and falling terms.
"""
from __future__ import annotations

import json
import os
from pathlib import Path

import yaml

from portfolio.core.config import PLATFORM
TARGET = PLATFORM / "target"
BLOCKING = ("fail", "error", "skipped")
# A file of at least MIN_ROWS_CHECKED rows may lose at most MAX_ROW_DROP of them per release.
MAX_ROW_DROP = 0.3
MIN_ROWS_CHECKED = 100


def built_by(group: str) -> dict[str, bool]:
    """dbt target directory -> whether only manual subjects build it, for the subjects that deliver
    into the group, in pipeline order."""
    subjects = yaml.safe_load((PLATFORM / "pipeline.yml").read_text(encoding="utf-8"))["subjects"]
    found: dict[str, bool] = {}
    for name, subject in subjects.items():
        if subject.get("group") == group and any("dbt" in step for step in subject["steps"]):
            target = subject.get("target", name)
            found[target] = found.get(target, True) and bool(subject.get("manual"))
    return found


def targets(group: str) -> list[str]:
    """dbt target directories of the subjects that deliver into the group, in pipeline order."""
    return list(built_by(group))


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
    names = built_by(group)
    if not names:
        return {"status": "not_run", "reason": "no subject in pipeline.yml builds dbt models for this group"}
    subjects = {name: summarise(TARGET / name / "run_results.json") for name in names}
    ran = [s["status"] for s in subjects.values() if s["status"] != "not_run"]
    if not ran:
        return {"status": "not_run", "reason": "no dbt run_results.json for this group at release time",
                "subjects": subjects}
    missing = [n for n, s in subjects.items() if s["status"] == "not_run" and not names[n]]
    if missing:
        return {"status": "error", "scope": "dbt build of each subject in the group",
                "not_run": missing, "subjects": subjects}
    status = "error" if "error" in ran else "warn" if "warn" in ran else "pass"
    return {"status": status, "scope": "dbt build of each subject in the group", "subjects": subjects}


def rows(path: str, value, nested: list[str] | None = None) -> int | None:
    """Rows of a tabular file: a JSON array, a JSON object's `rows`, `data` or `items` array (the
    news feed, the Workers AI passage lists), or Parquet. With `nested` keys, the items of those
    lists inside each row are counted instead."""
    if path.endswith(".parquet"):
        import pyarrow as pa
        import pyarrow.parquet as pq
        return pq.ParquetFile(pa.BufferReader(value)).metadata.num_rows
    if isinstance(value, dict):
        value = next((value[k] for k in ("rows", "data", "items") if isinstance(value.get(k), list)), None)
    if not isinstance(value, list):
        return None
    if not nested:
        return len(value)
    return sum(len(row.get(key) or []) for row in value if isinstance(row, dict) for key in nested)


def reconcile(payloads: dict[str, bytes], count_rows: dict[str, list[str]] | None = None) -> dict:
    """Row counts per published file. Where an exporter recorded the source table's count beside a
    published path (welfare/datasets.json: {table, path, rows}), the published count must equal it."""
    values = {p: json.loads(d) if p.endswith(".json") else d
              for p, d in payloads.items() if p.endswith((".json", ".parquet"))}
    count_rows = count_rows or {}
    counts = {p: n for p, v in values.items() if (n := rows(p, v, count_rows.get(p))) is not None}
    checks = {}
    for path, value in values.items():
        for entry in value if isinstance(value, list) else []:
            if isinstance(entry, dict) and isinstance(entry.get("rows"), int) and entry.get("path") in counts:
                checks[entry["path"]] = {"source": f"{path}#{entry.get('table', entry['path'])}",
                                         "expected": entry["rows"], "published": counts[entry["path"]],
                                         "match": entry["rows"] == counts[entry["path"]]}
    return {"status": "mismatch" if any(not c["match"] for c in checks.values())
            else "match" if checks else "counts_only", "rows": counts, "checks": checks}


def row_drops(active: dict[str, int], published: dict[str, int], always=()) -> dict:
    """Files that lost more than MAX_ROW_DROP of the active release's rows; a file gone counts as 0.
    Files in `always` are checked below MIN_ROWS_CHECKED too. `allowed` is true only for a path
    named in PORTFOLIO_ALLOW_ROW_DROP."""
    allowed = {p.strip() for p in os.environ.get("PORTFOLIO_ALLOW_ROW_DROP", "").split(",")}
    return {path: {"active": before, "published": published.get(path, 0), "allowed": path in allowed}
            for path, before in active.items()
            if (before >= MIN_ROWS_CHECKED or path in always)
            and published.get(path, 0) < before * (1 - MAX_ROW_DROP)}


def gate(group: str, payloads: dict[str, bytes], active_rows: dict[str, int] | None = None,
         count_rows: dict[str, list[str]] | None = None) -> tuple[dict, dict]:
    """The manifest's `dq` and `reconcile`; raises before upload when either blocks. active_rows is
    `reconcile.rows` of the group's active release; count_rows is the delivery spec's."""
    quality, counts = dq(group), reconcile(payloads, count_rows)
    if quality["status"] == "error":
        failing = sorted({n for s in quality["subjects"].values() for n in s.get("failing", [])})
        failing += [f"{n} (not run)" for n in quality.get("not_run", [])]
        raise ValueError(f"dbt gate blocks {group}: {', '.join(failing[:10])}")
    if counts["status"] == "mismatch":
        bad = [p for p, c in counts["checks"].items() if not c["match"]]
        raise ValueError(f"Row reconciliation failed for {group}: {', '.join(bad)}")
    drops = row_drops(active_rows or {}, counts["rows"], set(count_rows or {}))
    if blocked := [f"{p} ({d['active']} to {d['published']})" for p, d in drops.items() if not d["allowed"]]:
        raise ValueError(f"Row drop blocks {group}: {', '.join(blocked[:10])}; if intended, name the "
                         "paths in PORTFOLIO_ALLOW_ROW_DROP")
    if drops:
        counts["drops"] = drops
    return quality, counts
