"""SWEDEN E, The Lost Futures: the session archive pattern, the marker count, the Swedish-only
DiVA abstract, record-level deduplication in the theses mart, the running-year rule and the
rejected joins' reasons."""
import re
import sys
from pathlib import Path

import duckdb
import pyarrow as pa
import pyarrow.parquet as pq

ROOT = Path(__file__).resolve().parents[2]
for sub in ("ingest/riksdagen", "ingest/diva", "publish/sweden"):
    sys.path.insert(0, str(ROOT / sub))

import futures_language  # noqa: E402
import futures_theses  # noqa: E402
from export_connections import rejected_joins  # noqa: E402
from export_futures import kept_years  # noqa: E402
from harvest import parse  # noqa: E402

TERMS = [("future", re.compile(r"\bframtid\w*", re.I)), ("crisis", re.compile(r"\bkris\w*", re.I))]


def test_archive_pattern_reads_six_and_eight_digit_sessions():
    html = ("https://data.riksdagen.se/dataset/anforande/anforande-199899.json.zip "
            "https://data.riksdagen.se/dataset/anforande/anforande-19992000.json.zip")
    assert [m.group(1) for m in futures_language.ARCHIVE.finditer(html)] == ["199899", "19992000"]


def test_riksdag_count_keeps_marker_matches_and_drops_repeats():
    speech = {"id": "a-1", "date": "2024-03-01", "party": "S", "speaker": "X",
              "text": "Framtiden och framtidens kris."}
    totals, hits, _, stats = futures_language.count([speech, speech], TERMS)
    assert stats == {"speeches": 1}
    assert totals[("2024", "S")] == [1, 1, 4, 2]  # speeches, future, words, marker matches
    assert hits[("2024", "S", "crisis")] == [1, 1, 1]


def test_only_the_swedish_abstract_counts_in_either_order():
    sv = "Denna uppsats handlar om framtiden och det som är viktigt för kommunen."
    en = "This thesis is about the future of the municipality and the region."
    assert futures_theses.swedish([en, sv]) == sv
    assert futures_theses.swedish([sv, en]) == sv
    assert futures_theses.swedish([en]) is None


def test_theses_rows_carry_ids_and_mark_records_left_out():
    records = [
        {"id": "r1", "title": "Kris", "descriptions": ["Om framtiden och krisen i det som är svenskt.",
                                                      "About the future and the crisis."],
         "year": 2020, "language": "swe"},
        {"id": "r2", "deleted": True},
        {"id": "r3", "title": "Thesis", "descriptions": ["In English only."], "year": 2020, "language": "swe"},
    ]
    rows = futures_theses.count(records, TERMS, "2020-05")
    assert {(r["id"], r["theme"], r["year"]) for r in rows} == {
        ("r1", "_all", 2020), ("r1", "crisis", 2020), ("r2", "_all", None), ("r3", "_all", None)}
    total = next(r for r in rows if r["id"] == "r1" and r["theme"] == "_all")
    assert total["future"] and total["words"] == 10  # title and the Swedish abstract only


def test_parse_can_return_deleted_records():
    page = (b'<OAI-PMH xmlns="http://www.openarchives.org/OAI/2.0/"><ListRecords><record>'
            b'<header status="deleted"><identifier>oai:DiVA.org:x-1</identifier></header>'
            b'</record></ListRecords></OAI-PMH>')
    assert parse(page) == ([], None)
    assert parse(page, deleted=True) == ([{"id": "oai:DiVA.org:x-1", "deleted": True}], None)


def test_theses_mart_counts_each_record_once_at_its_latest_month(tmp_path):
    def month(name, rows):
        pq.write_table(pa.Table.from_pylist(rows, schema=futures_theses.SCHEMA), tmp_path / f"{name}.parquet")

    row = {"theme": "_all", "future": True, "matches": 0, "words": 100}
    month("before-2000", [{"month": "before-2000", "id": "old", "year": 1998, **row}])
    month("2020-01", [{"month": "2020-01", "id": "a", "year": 2019, **row},
                      {"month": "2020-01", "id": "b", "year": 2019, **row},
                      {"month": "2020-01", "id": "a", "year": 2019, **{**row, "theme": "crisis", "matches": 2}}])
    # a changed (no longer future-oriented), b deleted: both come back in a later month.
    month("2021-06", [{"month": "2021-06", "id": "a", "year": 2019, **{**row, "future": False}},
                      {"month": "2021-06", "id": "b", "year": None, **row}])
    con = duckdb.connect()
    con.execute(f"create view stg_futures_theses as select * from read_parquet("
                f"'{tmp_path.as_posix()}/*.parquet', union_by_name = true)")
    con.execute("create view future_terms as select 'crisis' as term_id, 'theme' as family")
    for name in ("silver/sweden_futures/int_sweden_future_theses_latest", "gold/sweden_futures/mart_sweden_future_theses_total"):
        sql(con, name, f"create view {name.rsplit('/', 1)[1]} as ")
    total = con.sql("select year, abstracts, future_abstracts, words from mart_sweden_future_theses_total order by year")
    assert total.fetchall() == [(1998, 1, 1, 100), (2019, 1, 0, 100)]
    got = sql(con, "gold/sweden_futures/mart_sweden_future_theses", "", " order by year").fetchall()
    # year, theme, abstracts using, future using, matches
    assert [r[:5] for r in got] == [(1998, "crisis", 0, 0, 0), (2019, "crisis", 0, 0, 0)]


def sql(con, name: str, prefix: str, suffix: str = ""):
    """A dbt model's SQL with its config dropped and each ref() read as a view of that name."""
    source = (ROOT / f"models/{name}.sql").read_text(encoding="utf-8")
    source = re.sub(r"\{\{ config\(.*?\) \}\}", "", source)
    return con.execute(prefix + re.sub(r"\{\{ ref\('([^']+)'\) \}\}", r"\1", source) + suffix)


def test_running_year_and_thin_edges_are_left_out():
    per_year = {1993: 4000, 1994: 11000, 1995: 12000, 2025: 13000, 2026: 10000}
    assert kept_years(per_year, running=2026) == {1994, 1995, 2025}


def test_rejected_joins_give_the_current_reasons():
    ads, theses = rejected_joins({2015, 2016, 2017}, {2016, 2017, 2018}, 0.83, False)
    assert ads["reason"].startswith("2 years (2016–2017)") and "0.83" in ads["reason"]
    assert "backfill" not in ads["reason"] and "not yet counted" not in theses["reason"]
