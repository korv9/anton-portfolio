"""The welfare ingestion helpers: PxWeb query planning, the bronze store and ESS metadata."""
import gzip
import json

import pytest

import ess_ingest
import pxweb
import rawstore

META = {"variables": [
    {"code": "Region", "values": ["00", "01", "03"], "elimination": True},
    {"code": "Kon", "values": ["1", "2"], "elimination": True},
    {"code": "Alder", "values": ["0", "1"], "elimination": False},
    {"code": "Tid", "values": [str(y) for y in range(2000, 2010)], "time": True},
]}


def selection(query, code):
    return next(q["selection"]["values"] for q in query if q["code"] == code)


def test_plan_splits_on_time_under_cell_limit_and_covers_every_period():
    queries = pxweb.plan_queries(META, max_cells=30)
    per_slice = 3 * 2 * 2
    assert all(len(selection(q, "Tid")) * per_slice <= 30 for q in queries)
    periods = [t for q in queries for t in selection(q, "Tid")]
    assert periods == META["variables"][3]["values"]


def test_plan_selects_every_variable_explicitly():
    (query,) = pxweb.plan_queries(META)
    assert [q["code"] for q in query] == ["Region", "Kon", "Alder", "Tid"]
    assert selection(query, "Region") == ["00", "01", "03"]


def test_plan_honours_selections_and_elimination():
    (query,) = pxweb.plan_queries(META, {"Region": ["01"]}, eliminate=("Kon",))
    assert [q["code"] for q in query] == ["Region", "Alder", "Tid"]
    assert selection(query, "Region") == ["01"]


def test_plan_refuses_unknown_and_non_eliminable_variables():
    with pytest.raises(ValueError, match="Unknown"):
        pxweb.plan_queries(META, {"Lan": ["01"]})
    with pytest.raises(ValueError, match="cannot be eliminated"):
        pxweb.plan_queries(META, eliminate=("Alder",))


@pytest.fixture
def raw(tmp_path, monkeypatch):
    monkeypatch.setattr(rawstore, "RAW", tmp_path)
    return tmp_path


def manifest(raw, source):
    return [json.loads(line) for line in (raw / source / "_manifest.jsonl").read_text().splitlines()]


def test_store_records_provenance_and_skips_identical_refetch(raw):
    path = rawstore.store("src", "a/data.json", b'{"x": 1}', url="https://example.test/a")
    first_mtime = path.stat().st_mtime_ns
    rawstore.store("src", "a/data.json", b'{"x": 1}', url="https://example.test/a")
    lines = manifest(raw, "src")
    assert [line["changed"] for line in lines] == [True, False]
    assert lines[0]["sha256"] == rawstore.sha256(b'{"x": 1}')
    assert lines[0]["url"] == "https://example.test/a" and lines[0]["bytes"] == 8
    assert path.stat().st_mtime_ns == first_mtime


def test_store_compresses_gz_but_hashes_the_bytes_as_received(raw):
    payload = b"a,b\n1,2\n" * 100
    path = rawstore.store("src", "t.csv.gz", payload, url="https://example.test/t")
    assert gzip.decompress(path.read_bytes()) == payload
    assert manifest(raw, "src")[0]["sha256"] == rawstore.sha256(payload)
    assert rawstore.stored_sha(path) == rawstore.sha256(payload)


def test_store_rewrites_when_content_changes(raw):
    path = rawstore.store("src", "d.json", b"1", url="u")
    rawstore.store("src", "d.json", b"2", url="u")
    assert path.read_bytes() == b"2"
    assert [line["changed"] for line in manifest(raw, "src")] == [True, True]


def test_ess_variable_names_reads_nested_groups():
    groups = [{"variables": [{"name": {"en": "cntry"}}],
               "variableGroups": [{"variables": [{"name": {"en": "ppltrst"}}],
                                   "variableGroups": [{"variables": [{"name": {"en": "stflife"}}]}]}]}]
    assert ess_ingest.variable_names(groups) == {"cntry", "ppltrst", "stflife"}
