"""The IT report's import: quarterly archives, the stream after the last archive, and its coverage."""
import gzip
import json
import sys
from datetime import date
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "platform/ingest/jobtech"))

import ingest_history as history
import run_history_pipeline as pipeline


def test_archive_months_cover_a_year_or_a_quarter():
    assert history.archive_months("2025") == [date(2025, m, 1) for m in range(1, 13)]
    assert history.archive_months("2026-Q2") == [date(2026, 4, 1), date(2026, 5, 1), date(2026, 6, 1)]


def test_quarters_are_used_only_for_a_year_without_its_yearly_archive():
    names = ["2020", "2025", "2025-Q4", "2026-Q1", "2026-Q2"]
    assert pipeline.archives(names) == ["2020", "2025", "2026-Q1", "2026-Q2"]


def ad(i, published, headline="Data Engineer", removed=False):
    return {"id": str(i), "headline": headline, "publication_date": published, "removed": removed}


def test_stream_imports_candidates_after_the_archive_and_marks_only_whole_months_complete(tmp_path):
    raw = tmp_path / "raw"
    (raw / "jobtech/stream/raw").mkdir(parents=True)
    (raw / "jobtech/market").mkdir(parents=True)
    (raw / "jobtech/market/manifest_stream.json").write_text(json.dumps(
        {"complete_from": "2026-10-07", "last_complete_day": "2026-12-03", "sha256": "x"}))
    answers = {
        "2026-10-06T0000": [ad(1, "2026-09-30T10:00:00"), ad(2, "2026-10-08T09:00:00")],
        "2026-11-02T0000": [ad(3, "2026-11-02T08:00:00"), ad(4, "2026-11-02T08:00:00", "Kock"),
                            {"id": "2", "removed": True}],
        "2026-12-05T0000": [ad(5, "2026-12-04T08:00:00")],  # after the last complete day
    }
    for name, items in answers.items():
        (raw / f"jobtech/stream/raw/{name}.json.gz").write_bytes(gzip.compress(json.dumps(items).encode()))
    database = tmp_path / "history.duckdb"
    result = history.import_stream(database, date(2026, 9, 30), raw)
    assert result["ads"] == 3 and result["candidate_rows"] == 2
    with duckdb.connect(str(database)) as con:
        assert sorted(r for (r,) in con.execute("select job_id from raw.job_ads").fetchall()) == ["2", "3"]
        assert con.execute("""select publication_month, source_rows, candidate_rows, status
            from raw.collection_coverage order by 1""").fetchall() == [
            (date(2026, 10, 1), 1, 1, "partial"),
            (date(2026, 11, 1), 2, 1, "complete"),
            (date(2026, 12, 1), 0, 0, "partial")]


def test_without_a_stored_stream_nothing_is_written(tmp_path):
    assert history.import_stream(tmp_path / "history.duckdb", date(2026, 9, 30), tmp_path) is None
    assert not (tmp_path / "history.duckdb").exists()
