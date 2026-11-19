"""The run's sensor counts and the DQ history (platform/pipeline_quality.py)."""
import json
import os
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "platform"))

import pipeline_quality as quality  # noqa: E402
from portfolio.storage import rawstore  # noqa: E402


def test_the_sensor_counts_only_this_runs_fetches_by_the_subject(tmp_path, monkeypatch):
    monkeypatch.setattr(rawstore, "RAW", tmp_path)
    lines = [
        {"path": "a", "run_id": "7", "subject": "s", "changed": True},
        {"path": "b", "run_id": "7", "subject": "s", "changed": False, "not_modified": True},
        {"path": "c", "run_id": "7", "subject": "s", "changed": False},
        {"path": "d", "run_id": "7", "subject": "s", "error": "HTTP 503"},
        {"path": "e", "run_id": "6", "subject": "s", "changed": True},
        {"path": "f", "run_id": "7", "subject": "other", "changed": True},
    ]
    (tmp_path / "src").mkdir()
    (tmp_path / "src/_manifest.jsonl").write_text("".join(json.dumps(x) + "\n" for x in lines) + "{broken\n")
    found = quality.sensor("s", ["src/x", "src/y", "absent"], run="7")
    assert found == {"changed": 1, "not_modified": 1, "unchanged": 1, "failed": 1}
    assert "| s | 1 | 1 | 1 | 1 |" in quality.report({"s": found})


def test_dq_history_keeps_the_tests_of_the_step_that_just_ran(tmp_path, monkeypatch):
    monkeypatch.setenv("GITHUB_RUN_ID", "9")
    monkeypatch.setenv("GITHUB_RUN_ATTEMPT", "2")
    target = tmp_path / "target/demo"
    target.mkdir(parents=True)
    results = target / "run_results.json"
    results.write_text(json.dumps({"metadata": {"generated_at": "2026-11-19T10:00:00Z"}, "results": [
        {"unique_id": "model.p.m", "status": "success"},
        {"unique_id": "test.p.not_null_m_id.1", "status": "fail", "failures": 3, "message": "Got 3"},
    ]}))
    began = time.time()
    os.utime(results, (began - 60, began - 60))
    assert quality.record_dq(tmp_path / "features", "demo", target, 1, began) is None, "an older run's file"
    os.utime(results, None)
    path = quality.record_dq(tmp_path / "features", "demo", target, 1, began - 1)
    assert path == tmp_path / "features/quality/dq_results/demo/9-2-1.jsonl"
    rows = [json.loads(line) for line in path.read_text().splitlines()]
    assert rows == [{"run_id": "9", "subject": "demo", "target": "demo", "executed_at": "2026-11-19T10:00:00Z",
                     "unique_id": "test.p.not_null_m_id.1", "status": "fail", "failures": 3,
                     "execution_time": None, "message": "Got 3"}]
