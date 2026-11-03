"""The release gate's decisions on dbt run_results.json and row reconciliation."""
import io
import json

import pyarrow as pa
import pyarrow.parquet as pq
import pytest

from portfolio.publish import dq_gate as g


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


BASELINE_SUBJECTS = ("ai_act", "ai_politics", "concepts", "cross_domain", "job_ai_governance", "philosophy",
                     "philosophy_moral", "politics", "quality_build", "sfs", "symbolic")


def test_an_unexpected_not_run_blocks_and_a_manual_one_does_not(target):
    # The live baseline: every subject of --all ran, the manual ai_act_diffusion did not.
    for name in BASELINE_SUBJECTS:
        results(target, name, ("test", "pass"))
    quality = g.dq("baseline")
    assert quality["status"] == "pass"
    assert quality["subjects"]["ai_act_diffusion"]["status"] == "not_run"
    (target / "sfs" / "run_results.json").unlink()
    assert g.dq("baseline")["not_run"] == ["sfs"]
    with pytest.raises(ValueError, match=r"sfs \(not run\)"):
        g.gate("baseline", {})


def test_a_group_with_no_results_stays_not_run(target):
    # publish-r2.yml stages a release from a fresh checkout (docs/r2-delivery-contract.md).
    assert g.dq("baseline")["status"] == "not_run"


def test_a_large_row_drop_blocks_unless_the_file_is_named(target, monkeypatch):
    rows = {"a.json": json.dumps(list(range(69))).encode(), "small.json": b"[]", "same.json": b"[1]"}
    active = {"a.json": 100, "small.json": 99, "same.json": 1}
    with pytest.raises(ValueError, match=r"a\.json \(100 to 69\).*PORTFOLIO_ALLOW_ROW_DROP"):
        g.gate("jobs", rows, active)
    assert "drops" not in g.gate("jobs", rows, {"a.json": 98})[1]  # below the size checked
    assert "drops" not in g.gate("jobs", rows, {"a.json": 90})[1]
    monkeypatch.setenv("PORTFOLIO_ALLOW_ROW_DROP", "other.json, a.json")
    assert g.gate("jobs", rows, active)[1]["drops"] == {"a.json": {"active": 100, "published": 69, "allowed": True}}
    with pytest.raises(ValueError, match=r"gone\.json \(500 to 0\)"):
        g.gate("jobs", rows, {"gone.json": 500})


def test_an_emptied_news_feed_is_a_row_drop(target):
    """parliament/news.json keeps its rows under `items`: 404 political items cannot become none."""
    news = {"parliament/news.json": json.dumps({"generated_at": "2026-11-02", "items": []}).encode()}
    assert g.reconcile(news)["rows"] == {"parliament/news.json": 0}
    with pytest.raises(ValueError, match=r"news\.json \(404 to 0\)"):
        g.gate("news", news, {"parliament/news.json": 404})
