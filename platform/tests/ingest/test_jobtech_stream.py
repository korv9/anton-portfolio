"""The daily job-ad stream: where the archives end, and each ad counted once, by the day it was
published, only for the days and months the stream has read whole."""
import json
from datetime import date, datetime
from unittest import mock

import pyarrow.parquet as pq
import pytest

import ingest_stream as st


def ad(id, day, field="F1", removed=False):
    if removed:
        return {"id": id, "removed": True, "occupation_field": {"concept_id": field}}
    return {"id": id, "publication_date": f"{day}T08:00:00", "number_of_vacancies": 2,
            "occupation_field": {"concept_id": field, "label": "Data/IT"},
            "occupation_group": {"concept_id": "G", "legacy_ams_taxonomy_id": "2512",
                                 "label": "Utvecklare"},
            "workplace_address": {"region": "Stockholms län"},
            "employment_type": {"label": "Vanlig anställning"},
            "working_hours_type": {"label": "Heltid"}, "experience_required": True}


@pytest.fixture
def dirs(tmp_path, monkeypatch):
    stream, market = tmp_path / "stream", tmp_path / "market"
    market.mkdir()
    (market / "manifest_2026-Q3.json").write_text("{}")
    monkeypatch.setattr(st, "STREAM", stream)
    monkeypatch.setattr(st, "MARKET", market)
    monkeypatch.setattr(st, "STATE", stream / "state.json")
    return stream, market


def test_an_archive_ends_on_its_period_last_day():
    assert st.archive_end("2025") == date(2025, 12, 31)
    assert st.archive_end("2026-Q2") == date(2026, 6, 30)
    assert st.archive_end("2026-Q4") == date(2026, 12, 31)


def run(windows, until, monkeypatch):
    """main() with the stream answering from `windows` (one list of ads per call)."""
    answers = iter(windows)
    monkeypatch.setattr(st, "fetch_window", lambda http, a, b: next(answers, []))
    with mock.patch("sys.argv", ["ingest_stream.py", "--until", until]):
        st.main()


def test_each_ad_counts_once_by_its_publication_day(dirs, monkeypatch):
    stream, market = dirs
    # First run on 2 November: reads 1 November too, counts from 2 November.
    run([[ad("old", "2026-11-01")], [ad("a", "2026-11-02")]], "2026-11-02T23:00", monkeypatch)
    state = json.loads((stream / "state.json").read_text())
    assert state == {"complete_from": "2026-11-02", "fetched_until": "2026-11-02T23:00:00"}
    # Next morning: "a" changed again (ignored), "b" new, "c" removed (no date: not counted).
    run([[ad("a", "2026-11-02"), ad("b", "2026-11-02"), ad("c", "2026-11-03", removed=True),
          ad("d", "2026-11-03")]], "2026-11-03T06:00", monkeypatch)
    daily = pq.read_table(market / "daily_stream.parquet").to_pylist()
    # Only 2 November is complete: "a" and "b", per field and for all fields.
    assert {(r["publication_date"], r["field_id"], r["ads"], r["vacancies"]) for r in daily} == {
        ("2026-11-02", "F1", 2, 4), ("2026-11-02", "all", 2, 4)}
    manifest = json.loads((market / "manifest_stream.json").read_text())
    assert manifest["ads"] == 3 and manifest["duplicates"] == 0
    assert manifest["last_complete_day"] == "2026-11-02"
    # November is not whole from its first day, so no month is counted yet.
    assert manifest["first_whole_month"] == "2026-12"
    assert pq.read_table(market / "ads_stream.parquet").num_rows == 0


def test_a_month_counts_once_the_stream_covers_it_from_its_first_day(dirs, monkeypatch):
    _, market = dirs
    run([[], [ad("x", "2026-12-01")]], "2026-12-01T12:00", monkeypatch)
    rows = pq.read_table(market / "ads_stream.parquet").to_pylist()
    assert [(r["publication_month"], r["ads"]) for r in rows] == [("2026-12", 1)]


def test_an_answer_cut_off_in_transit_is_fetched_again_not_stored(dirs, monkeypatch):
    """JobStream once sent 29 MB of a day's changes and the connection dropped mid-answer."""
    stored = []
    monkeypatch.setattr(st.rawstore, "store", lambda *a, **k: stored.append(a[2]))
    monkeypatch.setattr(st.time, "sleep", lambda s: None)

    class Response:
        def __init__(self, body):
            self.content = body

        def raise_for_status(self):
            pass

    answers = iter([b'[{"id": "1", "headline": "cut', b'[{"id": "1"}]'])
    http = mock.Mock(get=lambda url, timeout: Response(next(answers)))
    items = st.fetch_window(http, datetime(2026, 11, 2), datetime(2026, 11, 2, 6))
    assert items == [{"id": "1"}]
    assert stored == [b'[{"id": "1"}]']
