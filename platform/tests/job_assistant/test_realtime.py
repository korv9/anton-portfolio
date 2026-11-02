"""Ten-minute flow: overlapping reads, duplicates, late events, API errors and restarts lose nothing
and duplicate nothing; stages record their own state and recover on their own."""
import json
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "platform/job_assistant"))
sys.path.insert(0, str(ROOT / "platform/lib"))
import ads as store  # noqa: E402
import rawstore  # noqa: E402
import realtime  # noqa: E402

IT = {"concept_id": store.IT_FIELD}
T0 = 1792500000000  # 2026-10-20 10:40 Stockholm


def ad(id, text="Vi söker en dataingenjör. Krav: Python och SQL.", at=T0):
    return {"id": id, "headline": "Data Engineer", "employer": {"name": "Exempel AB"},
            "workplace_address": {"municipality": "Stockholm"}, "description": {"text": text},
            "occupation_field": IT, "publication_date": "2026-10-20T08:00:00", "timestamp": at,
            "webpage_url": f"https://arbetsformedlingen.se/platsbanken/annonser/{id}"}


def removed(id, when="2026-10-23T10:00:00"):
    return {"id": id, "removed": True, "removed_date": when, "occupation_field": IT}


class Http:
    """JobStream by window start: an answer list, an Exception to raise, or raw bytes to serve."""
    def __init__(self, answers):
        self.answers, self.calls = answers, []

    def get(self, url, timeout, params=None):
        key = url.split("date=")[1].split("&")[0]
        self.calls.append(key)
        body = self.answers.get(key, [])
        if isinstance(body, Exception):
            raise body
        content = body if isinstance(body, bytes) else json.dumps(body).encode()
        return type("R", (), {"content": content, "raise_for_status": lambda self: None})()


@pytest.fixture(autouse=True)
def raw(tmp_path, monkeypatch):
    monkeypatch.setattr(rawstore, "RAW", tmp_path)
    monkeypatch.setattr(store, "pause", lambda seconds: None)
    (tmp_path / "job_assistant").mkdir()
    cursor("2026-10-23T12:00:00")
    return tmp_path / "job_assistant"


def cursor(value=None):
    path = rawstore.RAW / "job_assistant/state.json"
    if value:
        path.write_text(json.dumps({"fetched_until": value}))
    return json.loads(path.read_text())["fetched_until"]


def rows():
    return store.load_ads(rawstore.RAW / "job_assistant/ads.json")


def clock():
    return "2026-10-23T12:30:00+00:00"


def at(stamp):
    return datetime.strptime(stamp, store.STAMP)


def test_overlap_rereads_without_duplicates_and_cursor_never_moves_back():
    answers = {"2026-10-23T12:00:00": [ad("1"), ad("2")], "2026-10-23T12:00:00b": []}
    store.run(at("2026-10-23T12:10:00"), Http(answers), clock)
    # The next run starts ten minutes before the cursor and gets the same two ads again.
    answers = {"2026-10-23T12:00:00": [ad("1"), ad("2"), ad("3")]}
    record = store.run(at("2026-10-23T12:20:00"), Http(answers), clock, overlap=timedelta(minutes=10))
    assert sorted(rows()) == ["1", "2", "3"]
    assert (record["windows"][0]["new"], record["windows"][0]["unchanged"]) == (1, 2)
    assert cursor() == "2026-10-23T12:20:00"
    # A run asked for an earlier end than the cursor reads the overlap and leaves the cursor where it was.
    store.run(at("2026-10-23T12:15:00"), Http({}), clock, overlap=timedelta(minutes=10))
    assert cursor() == "2026-10-23T12:20:00"


def test_duplicate_events_in_one_answer_count_once():
    record = store.run(at("2026-10-23T12:10:00"), Http({"2026-10-23T12:00:00": [ad("1"), ad("1"), ad("1")]}), clock)
    window = record["windows"][0]
    assert (window["new"], window["unchanged"]) == (1, 2) and len(rows()) == 1


def test_late_older_event_never_overwrites_newer_state():
    newer = ad("1", text="Ny text. Krav: Python och Rust.", at=T0 + 3_600_000)
    store.run(at("2026-10-23T12:10:00"), Http({"2026-10-23T12:00:00": [newer]}), clock)
    # The older version arrives late, then a removal dated before the newer version.
    late = {"2026-10-23T12:10:00": [ad("1", at=T0), removed("1", "2026-10-20T10:50:00")]}
    record = store.run(at("2026-10-23T12:20:00"), Http(late), clock)
    row = rows()["1"]
    assert "Rust" in row["description"] and row["removed_at"] is None
    assert record["windows"][0]["stale"] == 2 and [h["event"] for h in row["history"]] == ["new"]
    # A removal after the newer version is applied.
    store.run(at("2026-10-23T12:30:00"), Http({"2026-10-23T12:20:00": [removed("1")]}), clock)
    assert rows()["1"]["removed_at"] == "2026-10-23T10:00:00"


def test_empty_answer_is_a_success_and_moves_the_cursor():
    record = store.run(at("2026-10-23T12:10:00"), Http({"2026-10-23T12:00:00": []}), clock)
    assert record["outcome"] == "ok" and record["windows"][0]["items"] == 0
    assert cursor() == "2026-10-23T12:10:00"


@pytest.mark.parametrize("failure", [ConnectionError("dropped"), b'{"error": "rate limited"}'])
def test_api_error_or_non_list_answer_keeps_the_cursor(failure, raw):
    with pytest.raises((ConnectionError, ValueError)):
        store.run(at("2026-10-23T12:10:00"), Http({"2026-10-23T12:00:00": failure}), clock)
    assert cursor() == "2026-10-23T12:00:00" and rows() == {}
    last = json.loads((raw / "runs.jsonl").read_text().splitlines()[-1])
    assert last["outcome"].startswith("failed")
    if isinstance(failure, Exception):
        assert "error" in json.loads((raw / "_manifest.jsonl").read_text().splitlines()[-1])


def test_restart_after_partial_failure_loses_and_duplicates_nothing():
    answers = {"2026-10-23T12:00:00": [ad("1")], "2026-10-23T18:00:00": ConnectionError("dropped")}
    with pytest.raises(ConnectionError):
        store.run(at("2026-10-23T20:00:00"), Http(answers), clock)
    assert cursor() == "2026-10-23T18:00:00" and sorted(rows()) == ["1"]
    answers["2026-10-23T18:00:00"] = [ad("2")]
    http = Http({**answers, "2026-10-23T17:50:00": [ad("1"), ad("2")]})
    store.run(at("2026-10-23T20:00:00"), http, clock, overlap=timedelta(minutes=10))
    assert http.calls == ["2026-10-23T17:50:00"] and sorted(rows()) == ["1", "2"]
    assert all(len(r["history"]) == 1 for r in rows().values())


def test_lock_refuses_a_second_writer_and_takes_over_a_stale_one(raw, monkeypatch):
    with realtime.lock():
        with pytest.raises(RuntimeError, match="another run"):
            with realtime.lock():
                pass
    stale = raw / "pipeline.lock"
    stale.write_text("1 old")
    old = (datetime.now() - timedelta(hours=2)).timestamp()
    os.utime(stale, (old, old))
    with realtime.lock():
        pass
    assert not stale.exists()
    # A fresh lock whose process has gone is taken over at once.
    stale.write_text("999999 killed")
    monkeypatch.setattr(realtime, "alive", lambda pid: False)
    with realtime.lock():
        pass


def fake_collect(monkeypatch, windows):
    def run(until, http=None, overlap=None):
        cursor((until).strftime(store.STAMP))
        return {"windows": windows, "ads": 1, "current": 1}
    monkeypatch.setattr(store, "run", run)


def test_stages_rerun_only_what_failed(monkeypatch, raw):
    fake_collect(monkeypatch, [{"items": 1, "new": 1, "earliest": "2026-10-23T12:01:00", "latest": "2026-10-23T12:01:00"}])
    realtime.stage("collect", realtime.collect)
    monkeypatch.setattr(realtime, "current_model", lambda: "m1")
    calls = []

    def analyse(status):
        calls.append(1)
        if len(calls) == 1:
            raise OSError("model cache unreadable")
        return {"input": realtime.cursor(), "model": "m1"}

    with pytest.raises(OSError):
        realtime.stage("analyse", analyse)
    status = json.loads((raw / "pipeline.json").read_text())
    assert status["analyse"]["ok"] is None and status["analyse"]["last"]["outcome"].startswith("failed")
    assert status["collect"]["ok"]["new"] == 1
    # The build refuses while the analysis is behind the store, then the analysis is redone alone.
    with pytest.raises(RuntimeError, match="run analyse first"):
        realtime.stage("build", realtime.build)
    realtime.stage("analyse", analyse)
    # Same cursor and model: the real analyse stage has nothing to do.
    assert realtime.stage("analyse", realtime.analyse)["outcome"] == "skipped"
    log = [json.loads(line)["outcome"][:6] for line in (raw / "realtime_runs.jsonl").read_text().splitlines()]
    assert log == ["ok", "failed", "failed", "ok", "skippe"]


def test_unpublished_changes_carry_over_a_failed_publication(monkeypatch, raw):
    fake_collect(monkeypatch, [{"items": 2, "new": 2, "earliest": "2026-10-23T12:01:00", "latest": "2026-10-23T12:05:00"}])
    realtime.stage("collect", realtime.collect)
    fake_collect(monkeypatch, [{"items": 0}])
    realtime.stage("collect", realtime.collect)
    status = json.loads((raw / "pipeline.json").read_text())
    status["build"] = {"ok": {"generated_at": "g1", "input": realtime.cursor()}}
    (raw / "pipeline.json").write_text(json.dumps(status))
    monkeypatch.setattr(realtime, "run", lambda *a, **k: (_ for _ in ()).throw(RuntimeError("upload refused")))
    with pytest.raises(RuntimeError):
        realtime.stage("publish", realtime.publish)
    assert json.loads((raw / "pipeline.json").read_text())["pending_changes"]["count"] == 2
    monkeypatch.setattr(realtime, "run", lambda *a, **k: None)
    entry = realtime.stage("publish", realtime.publish)
    assert entry["latency"]["changes"] == 2 and entry["latency"]["max_minutes"] >= entry["latency"]["min_minutes"] > 0
    assert "pending_changes" not in json.loads((raw / "pipeline.json").read_text())
    assert realtime.stage("publish", realtime.publish)["outcome"] == "skipped"

