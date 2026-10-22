"""The release gate's decisions on dbt run_results.json and row reconciliation."""
import io
import json
import sys
from pathlib import Path

import pyarrow as pa
import pyarrow.parquet as pq
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "publish"))
import dq_gate as g


def results(target, name, *statuses, which="build"):
    path = target / name / "run_results.json"
    path.parent.mkdir(parents=True)
    path.write_text(json.dumps({"metadata": {"generated_at": "2026-10-22T06:00:00Z"},
                                "args": {"which": which},
                                "results": [{"unique_id": f"{kind}.p.n{i}", "status": status}
                                            for i, (kind, status) in enumerate(statuses)]}),
                    encoding="utf-8")


@pytest.fixture
def target(tmp_path, monkeypatch):
    monkeypatch.setattr(g, "TARGET", tmp_path)
    return tmp_path


def test_group_targets_come_from_pipeline_yml():
    assert g.targets("jobs") == ["market"]
    assert "politics" in g.targets("baseline") and len(set(g.targets("baseline"))) == len(g.targets("baseline"))
    assert g.dq("jobs-analysis")["status"] == "not_run"  # no dbt step in that group


def test_failing_error_severity_test_blocks(target):
    results(target, "market", ("model", "success"), ("test", "pass"), ("test", "fail"))
    quality = g.dq("jobs")
    assert quality["status"] == "error"
    assert quality["subjects"]["market"]["tests"] == {"pass": 1, "warn": 0, "error": 1, "skip": 0}
    with pytest.raises(ValueError, match="test.p.n2"):
        g.gate("jobs", {})


def test_warn_only_passes_with_status_warn(target):
    results(target, "market", ("test", "pass"), ("test", "warn"))
    quality, _ = g.gate("jobs", {})
    assert quality["status"] == "warn"
    assert quality["subjects"]["market"]["warnings"] == ["test.p.n1"]


def test_missing_or_non_build_results_are_not_run(target):
    assert g.gate("jobs", {})[0]["status"] == "not_run"
    results(target, "market", ("model", "success"), which="compile")
    assert g.dq("jobs")["status"] == "not_run"


def test_row_counts_and_recorded_source_counts():
    table = io.BytesIO()
    pq.write_table(pa.table({"x": [1, 2, 3]}), table)
    payloads = {"a.json": b"[1,2]", "b.json": b'{"data":[1]}', "c.json": b'{"k":1}',
                "parquet/t.parquet": table.getvalue(),
                "datasets.json": b'[{"table":"t","path":"parquet/t.parquet","rows":3}]'}
    counts = g.reconcile(payloads)
    assert counts["rows"] == {"a.json": 2, "b.json": 1, "parquet/t.parquet": 3, "datasets.json": 1}
    assert counts["status"] == "match"
    payloads["datasets.json"] = b'[{"table":"t","path":"parquet/t.parquet","rows":4}]'
    with pytest.raises(ValueError, match="parquet/t.parquet"):
        g.gate("jobs-analysis", payloads)
