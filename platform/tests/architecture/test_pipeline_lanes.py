"""The weekly build's parallel ingest lanes (platform/pipeline_lanes.py): no two lanes write the
same raw source, a lane stores what it fetched whatever happened, and a lane that failed or
left no outcome stops its subjects in the build."""
import argparse
import importlib.util
import json
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "platform"))
sys.path.insert(0, str(ROOT / "platform/publish"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

import ingest_status  # noqa: E402
import pipeline_lanes  # noqa: E402
from data_workflows import workflow  # noqa: E402

SUBJECTS = yaml.safe_load((ROOT / "platform/pipeline.yml").read_text(encoding="utf-8"))["subjects"]


def load_cli():
    spec = importlib.util.spec_from_file_location("orchestration_cli", ROOT / "platform/pipeline.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_no_raw_source_is_written_from_two_lanes():
    owner = {}
    for name, subject in SUBJECTS.items():
        if subject.get("manual"):
            continue
        for path in subject.get("raw", []):
            source = path.split("/")[0]
            lane = subject.get("lane", f"build:{name}")
            assert owner.setdefault(source, lane) == lane, \
                f"{source} is written from lanes {owner[source]} and {lane}"


def test_every_weekly_subject_that_fetches_has_a_lane_or_needs_the_build():
    # news restores the published release into the checkout; quality reads the built warehouse.
    in_build = {"news", "quality"}
    for name, subject in SUBJECTS.items():
        fetches = any("ingest" in step for step in subject["steps"])
        if fetches and not subject.get("manual") and name not in in_build:
            assert subject.get("lane"), f"{name} ingests in the build job; give it a lane"
    assert not any(SUBJECTS[n].get("lane") for n in in_build)


def test_a_lane_without_an_outcome_or_with_an_error_fails_its_subjects(tmp_path):
    subjects = {"a": {"lane": "x"}, "b": {"lane": "x"}, "c": {"lane": "y"}, "d": {}}
    (tmp_path / "ingest-x.json").write_text(json.dumps({"a": None, "b": "exit 1: fetch.py"}))
    outcome = pipeline_lanes.read_results(tmp_path, subjects)
    assert outcome["a"] is None
    assert "exit 1: fetch.py" in outcome["b"]
    assert "left no ingest result" in outcome["c"], "a cancelled lane must not count as ingested"
    assert "d" not in outcome


def test_the_build_skips_a_laned_ingest_and_stops_what_failed(tmp_path, monkeypatch):
    cli = load_cli()
    ran = []
    monkeypatch.setattr(cli, "run_subject", lambda name, s, phases, ml, run: ran.append((name, sorted(phases))))
    config = {"subjects": {
        "a": {"lane": "x", "steps": [{"ingest": "python a.py"}]},
        "b": {"lane": "x", "steps": [{"ingest": "python b.py"}]},
        "c": {"needs": ["b"], "steps": [{"dbt": {"select": ["c"]}}]},
        "d": {"steps": [{"ingest": "python d.py"}]},
    }, "groups": {}}
    (tmp_path / "ingest-x.json").write_text(json.dumps({"a": None, "b": "timeout"}))
    args = argparse.Namespace(all=False, subjects=["a", "b", "c", "d"], only="ingest,dbt",
                              full_refresh=False, dry_run=True, ml="missing", results=None,
                              ingest_results=str(tmp_path))
    assert cli.command_run(args, config) == 1
    assert ran == [("a", ["dbt"]), ("d", ["dbt", "ingest"])]


def test_a_lane_writes_its_outcome(tmp_path, monkeypatch):
    cli = load_cli()
    monkeypatch.setattr(cli, "run_subject", lambda *a: None)
    config = {"subjects": {"a": {"steps": [{"dbt": {"select": ["a"]}}]}}, "groups": {}}
    out = tmp_path / "lanes/ingest-x.json"
    args = argparse.Namespace(all=False, subjects=["a"], only="dbt", full_refresh=False,
                              dry_run=True, ml="missing", results=str(out), ingest_results=None)
    assert cli.command_run(args, config) == 0
    assert json.loads(out.read_text()) == {"a": None}


def test_a_lane_stores_what_it_fetched_even_after_a_timeout():
    jobs = workflow("build-warehouse.yml")["jobs"]
    lane = jobs["ingest"]
    assert lane["strategy"]["fail-fast"] is False
    assert lane["timeout-minutes"] == "${{ matrix.job_timeout }}"
    names = [step.get("name", "") for step in lane["steps"]]
    fetch = lane["steps"][names.index("Fetch the lane's subjects")]
    store = lane["steps"][names.index("Store what the lane fetched, whatever the outcome")]
    assert fetch["timeout-minutes"] == "${{ matrix.timeout }}" and "--results" in fetch["run"]
    assert store["if"] == "${{ always() && steps.setup.outcome == 'success' }}"
    assert "pipeline.py push $SUBJECTS" in store["run"]
    build = jobs["build"]
    assert build["needs"] == "ingest" and "!cancelled()" in build["if"]
    assert any("--ingest-results tmp/lanes" in step.get("run", "") for step in build["steps"])
    for entry in pipeline_lanes.matrix(SUBJECTS):
        assert entry["job_timeout"] - entry["timeout"] >= 15, entry


class FakeS3:
    """A bucket whose stored file changes between the read and the first conditional write."""

    class exceptions:
        class NoSuchKey(Exception):
            pass

    def __init__(self):
        self.body, self.etag, self.puts = b'{"subjects": {"other": {"n": 1}}}', '"1"', 0

    def get_object(self, Bucket, Key):
        return {"Body": type("B", (), {"read": lambda _: self.body})(), "ETag": self.etag}

    def put_object(self, Bucket, Key, Body, IfMatch=None, **_):
        from botocore.exceptions import ClientError
        self.puts += 1
        if self.puts == 1:  # another lane wrote first
            self.body, self.etag = b'{"subjects": {"other": {"n": 1}, "lane2": {"n": 2}}}', '"2"'
        if IfMatch != self.etag:
            raise ClientError({"Error": {"Code": "PreconditionFailed"}}, "PutObject")
        self.body = Body


def test_parallel_lanes_do_not_lose_each_others_status(monkeypatch):
    monkeypatch.setattr(ingest_status.time, "sleep", lambda _: None)
    s3 = FakeS3()
    ingest_status.write_merged(s3, "bucket", "mine", {"n": 3})
    assert set(json.loads(s3.body)["subjects"]) == {"other", "lane2", "mine"}
    assert s3.puts == 2
