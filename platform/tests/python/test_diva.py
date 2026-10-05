"""DiVA: the OAI-PMH page parser on a hand-written Dublin Core response, and the topic clustering
on a small corpus with two clear subjects."""
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "ingest/diva"))
sys.path.insert(0, str(ROOT / "publish"))

from harvest import is_student_thesis, months, parse  # noqa: E402

PAGE = b"""<?xml version="1.0" encoding="UTF-8"?>
<OAI-PMH xmlns="http://www.openarchives.org/OAI/2.0/">
 <ListRecords>
  <record><header><identifier>oai:DiVA.org:kth-1</identifier></header>
   <metadata><oai_dc:dc xmlns:oai_dc="http://www.openarchives.org/OAI/2.0/oai_dc/" xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Batteries in electric buses</dc:title>
    <dc:description>We study battery ageing.</dc:description>
    <dc:subject>batteries</dc:subject><dc:subject>energy</dc:subject>
    <dc:type>Student thesis</dc:type><dc:type>info:eu-repo/semantics/masterThesis</dc:type>
    <dc:date>2024</dc:date><dc:language>eng</dc:language><dc:publisher>KTH</dc:publisher>
   </oai_dc:dc></metadata></record>
  <record><header status="deleted"><identifier>oai:DiVA.org:kth-2</identifier></header></record>
  <record><header><identifier>oai:DiVA.org:uu-3</identifier></header>
   <metadata><oai_dc:dc xmlns:oai_dc="http://www.openarchives.org/OAI/2.0/oai_dc/" xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>A doctoral thesis</dc:title><dc:type>Doctoral thesis, monograph</dc:type><dc:date>2023-05-01</dc:date>
   </oai_dc:dc></metadata></record>
  <resumptionToken cursor="0" completeListSize="3">tok123</resumptionToken>
 </ListRecords>
</OAI-PMH>"""


def test_parse_reads_dublin_core_skips_deleted_and_returns_the_token():
    records, token = parse(PAGE)
    assert token == "tok123"
    assert [r["id"] for r in records] == ["oai:DiVA.org:kth-1", "oai:DiVA.org:uu-3"]
    first = records[0]
    assert first["title"] == "Batteries in electric buses"
    assert first["subjects"] == ["batteries", "energy"]
    assert (first["year"], first["publisher"], first["language"]) == (2024, "KTH", "eng")
    assert records[1]["year"] == 2023
    assert [is_student_thesis(r) for r in records] == [True, False]


def test_no_records_is_an_empty_page():
    page = b'<OAI-PMH xmlns="http://www.openarchives.org/OAI/2.0/"><error code="noRecordsMatch"/></OAI-PMH>'
    assert parse(page) == ([], None)


def test_months_cover_the_range_with_month_ends():
    got = list(months("2024-11", "2025-02"))
    assert [g[0] for g in got] == ["2024-11", "2024-12", "2025-01", "2025-02"]
    assert got[3][2] == "2025-02-28"


def test_clustering_separates_two_subjects():
    pytest.importorskip("sklearn")
    from diva_clusters import cluster

    energy = ["battery storage grid", "solar panels battery", "wind power grid storage", "electric grid battery charging"]
    care = ["nurses patient care", "elderly care nurses", "patient safety hospital care", "hospital nurses stress"]
    records = [
        {"title": t, "abstract": t, "subjects": [], "year": 2020 + i % 3, "publisher": "KTH" if t in energy else "KI"}
        for i, t in enumerate((energy + care) * 3)
    ]
    out = cluster(records, ks=[2])
    assert out["k"] == 2
    by_words = {frozenset(c["words"][:3]) for c in out["clusters"]}
    assert len(out["clusters"]) == 2 and len(by_words) == 2
    sizes = sorted(c["size"] for c in out["clusters"])
    assert sizes == [12, 12]
    unis = {c["universities"][0]["name"] for c in out["clusters"]}
    assert unis == {"KTH", "KI"}
