"""Hourly ad store: no duplicates, changes and removals kept, and a stopped run resumes cleanly."""
import json
import sys
from datetime import datetime
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "platform/job_assistant"))
sys.path.insert(0, str(ROOT / "platform/lib"))
import ads as store  # noqa: E402
import rawstore  # noqa: E402

IT = {"concept_id": store.IT_FIELD}


def ad(id, text="Vi söker en dataingenjör. Krav: Python och SQL.", **extra):
    return {"id": id, "headline": "Data Engineer", "employer": {"name": "Exempel AB"},
            "workplace_address": {"municipality": "Stockholm", "region": "Stockholms län", "country_code": "199"},
            "description": {"text": text}, "occupation_field": IT, "publication_date": "2026-10-20T08:00:00",
            "webpage_url": f"https://arbetsformedlingen.se/platsbanken/annonser/{id}", "timestamp": 1792500000000,
            **extra}


def removed(id):
    return {"id": id, "removed": True, "removed_date": "2026-10-23T10:00:00", "occupation_field": IT}


class Http:
    """Answers by path and window start; `fail` raises on the named window."""
    def __init__(self, answers, fail=None):
        self.answers, self.fail, self.calls = answers, fail, []

    def get(self, url, timeout, params=None):
        if params:  # JobSearch: the first run's ads, all published on the last day
            day = params["published-after"][:10]
            hits = self.answers.get("snapshot", []) if day == "2026-10-23" else []
            body = {"hits": hits, "total": {"value": len(hits)}}
        else:
            key = url.split("date=")[1].split("&")[0]
            self.calls.append(key)
            if key == self.fail:
                raise ConnectionError("dropped")
            body = self.answers.get(key, [])
        content = json.dumps(body).encode()
        return type("R", (), {"content": content, "json": lambda self: body,
                              "raise_for_status": lambda self: None})()


@pytest.fixture(autouse=True)
def raw(tmp_path, monkeypatch):
    monkeypatch.setattr(rawstore, "RAW", tmp_path)
    monkeypatch.setattr(store, "pause", lambda seconds: None)
    return tmp_path


def clock():
    return "2026-10-23T12:00:00+00:00"


def stored(raw):
    return store.load_ads(raw / "job_assistant/ads.json")


def test_snapshot_then_new_changed_repeated_removed(raw):
    answers = {
        "snapshot": [ad("1"), ad("2"), {**ad("9"), "occupation_field": {"concept_id": "other"}}],
        "2026-10-23T05:50:00": [ad("2", text="Ny text. Krav: Python."), ad("3"), removed("1"), removed("404")],
    }
    record = store.run(datetime(2026, 10, 23, 6, 0), Http(answers), clock)
    rows = stored(raw)
    assert sorted(rows) == ["1", "2", "3"]
    snapshot, window = record["windows"]
    assert (snapshot["new"], snapshot["other_field"]) == (2, 1)
    assert (window["new"], window["changed"], window["removed"]) == (1, 1, 1)
    assert rows["1"]["removed_at"] == "2026-10-23T10:00:00"
    assert [h["event"] for h in rows["2"]["history"]] == ["new", "changed"]
    assert rows["2"]["first_seen"] == clock()
    assert "Python" in rows["3"]["description"] and rows["3"]["source_url"].endswith("/3")
    # The same window again, as after a crash before the cursor moved: nothing changes.
    before = stored(raw)
    state = raw / "job_assistant/state.json"
    state.write_text(json.dumps({"fetched_until": "2026-10-23T05:50:00"}))
    again = store.run(datetime(2026, 10, 23, 6, 0), Http(answers), clock)
    assert stored(raw) == before and again["windows"][0]["unchanged"] == 2


def test_duplicate_ids_point_at_the_first(raw):
    answers = {"snapshot": [ad("12"), ad("7"), ad("8", text="Annan text.")]}
    store.run(datetime(2026, 10, 23, 6, 0), Http(answers), clock)
    rows = stored(raw)
    assert rows["7"]["duplicate_of"] is None and rows["12"]["duplicate_of"] == "7"
    assert rows["8"]["duplicate_of"] is None


def test_republished_ad_reopens(raw):
    answers = {"snapshot": [ad("1")], "2026-10-23T05:50:00": [removed("1")],
               "2026-10-23T06:00:00": [ad("1")]}
    store.run(datetime(2026, 10, 23, 6, 0), Http(answers), clock)
    store.run(datetime(2026, 10, 23, 7, 0), Http(answers), clock)
    row = stored(raw)["1"]
    assert row["removed_at"] is None and [h["event"] for h in row["history"]] == ["new", "removed", "changed"]


def test_interrupted_run_resumes_where_it_stopped(raw):
    answers = {"2026-10-23T05:50:00": [ad("1"), ad("2")], "2026-10-23T11:50:00": [ad("3")]}
    (raw / "job_assistant").mkdir()
    (raw / "job_assistant/state.json").write_text(json.dumps({"fetched_until": "2026-10-23T05:50:00"}))
    with pytest.raises(ConnectionError):
        store.run(datetime(2026, 10, 23, 14, 0), Http(answers, fail="2026-10-23T11:50:00"), clock)
    assert sorted(stored(raw)) == ["1", "2"]
    assert json.loads((raw / "job_assistant/state.json").read_text())["fetched_until"] == "2026-10-23T11:50:00"
    http = Http(answers)
    store.run(datetime(2026, 10, 23, 14, 0), http, clock)
    assert http.calls == ["2026-10-23T11:50:00"] and sorted(stored(raw)) == ["1", "2", "3"]
    runs = [json.loads(line) for line in (raw / "job_assistant/runs.jsonl").read_text().splitlines()]
    assert runs[0]["outcome"].startswith("failed: ConnectionError") and runs[1]["outcome"] == "ok"
    assert (raw / "job_assistant/_manifest.jsonl").is_file()


def test_contact_details_are_redacted_and_links_checked(raw):
    answers = {"snapshot": [ad("1", text="Kontakta kim@example.com eller 070-123 45 67.",
                               webpage_url="http://insecure.example/ad")]}
    store.run(datetime(2026, 10, 23, 6, 0), Http(answers), clock)
    row = stored(raw)["1"]
    assert "@" not in row["description"] and row["contact_redactions"] == 2
    assert row["source_url"] == "https://arbetsformedlingen.se/platsbanken/annonser/1"
