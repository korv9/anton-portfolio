"""Documented attachment 404s do not certify unrelated failures or partial inputs."""
import json
import io
import sys
from pathlib import Path

import pytest
import requests
import rawstore
import studies_ingest as studies

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "ingest"))
import run_taxes as taxes


class Riksdag:
    def __init__(self):
        self.calls = []
        self.failures = {}

    def get(self, url, **kwargs):
        doc_id = url.rsplit("/", 1)[-1].removesuffix(".json")
        self.calls.append(doc_id)
        failure = self.failures.get(doc_id, 404 if "d" in doc_id else 200)
        if isinstance(failure, Exception):
            raise failure
        response = requests.Response()
        response.status_code = failure
        response.url = url
        response._content = json.dumps({"dokumentstatus": {
            "dokument": {"dok_id": doc_id, "rm": "2010/11", "beteckning": "101",
                         "titel": "Årsredovisning för staten 2010", "html": "Beredning finns."},
            "dokreferens": {"referens": [{"referenstyp": "behandlas_i", "ref_dok_typ": "bet",
                                           "ref_dok_id": "GY01FiU33"}]}}}).encode()
        return response


@pytest.fixture
def repair(tmp_path, monkeypatch):
    monkeypatch.setattr(rawstore, "RAW", tmp_path)
    monkeypatch.delenv("PORTFOLIO_FULL_REFRESH", raising=False)
    monkeypatch.setattr(sys, "argv", ["studies_ingest.py", "--session", "2010/11"])
    http = Riksdag()
    monkeypatch.setattr(rawstore, "session", lambda: http)
    parent = {"dok_id": "GY03101", "rm": "2010/11", "beteckning": "101"}
    bills = [parent] + [{**parent, "dok_id": f"GY03101d{i}", "relaterat_id": "GY03101",
                        "tempbeteckning": f"d{i}", "sokdata": {"statusrad": "<dt>Bilaga</dt>"}}
                       for i in range(2, 10)]

    def listing(http, kind, session, target, max_age_days=0):
        path = rawstore.store("riksdagen", f"studies/{target}-01.json",
                              json.dumps({"dokumentlista": {"dokument": bills}}).encode(), url="listing")
        rawstore.complete("riksdagen", "studies/listing/" + target, [path],
                          {"doc_type": kind, "period": session, "sort": "datum", "size": 500})
        return bills

    monkeypatch.setattr(studies, "listing", listing)
    return http, bills, tmp_path


def coverage(raw):
    return json.loads((raw / "riksdagen/studies/coverage/201011.json").read_text())


def test_eight_attachment_404s_are_audited_and_parent_is_required(repair):
    http, bills, raw = repair
    studies.main()
    report = coverage(raw)
    assert report["listed_documents"] == 9 and not report["pending_bills"]
    excluded = [d for d in report["documents"] if d["status"] == "unavailable_attachment"]
    assert len(excluded) == 8
    assert all(d["parent_id"] == "GY03101" and d["http_status"] == 404 for d in excluded)
    assert studies.stored_preparation("2010/11").keys() == {"GY03101"}
    sealed = rawstore.completed_paths("riksdagen", "studies/preparation/201011",
                                      studies.preparation_request("2010/11"))
    assert raw / "riksdagen/studies/coverage/201011.json" in sealed
    http.failures["GY03101"] = 404
    with pytest.raises(RuntimeError, match="Incomplete preparation"):
        studies.main()
    assert len(coverage(raw)["pending_bills"]) == 9
    assert studies.stored_preparation("2010/11")["GY03101"]["title"]
    assert coverage(raw)["documents"][0]["retained_previous"]
    assert rawstore.completed_paths("riksdagen", "studies/preparation/201011",
                                    studies.preparation_request("2010/11")) is None


@pytest.mark.parametrize("failure", [503, TimeoutError("temporary failure")])
def test_temporary_attachment_failure_is_pending_and_restart_reuses_parent(repair, failure):
    http, bills, raw = repair
    http.failures["GY03101d2"] = failure
    with pytest.raises(RuntimeError, match="Incomplete preparation"):
        studies.main()
    assert coverage(raw)["pending_bills"] == ["GY03101d2"]
    http.failures.clear()
    http.calls.clear()
    studies.main()
    assert "GY03101" not in http.calls
    assert not coverage(raw)["pending_bills"]


@pytest.mark.parametrize("field,value", [("relaterat_id", "unknown"), ("tempbeteckning", ""),
                                         ("sokdata", {}), ("rm", "2011/12")])
def test_unproven_404_is_never_excluded(repair, field, value):
    http, bills, raw = repair
    bills[1][field] = value
    with pytest.raises(RuntimeError, match="Incomplete preparation"):
        studies.main()
    assert coverage(raw)["pending_bills"] == ["GY03101d2"]


def test_missing_or_wrong_document_text_is_failure():
    class HTTP:
        def get(self, url, **kwargs):
            response = requests.Response()
            response.status_code = 200
            response._content = b'{"dokumentstatus":{"dokument":{"dok_id":"wrong","html":""}}}'
            return response
    with pytest.raises(ValueError, match="Incomplete documentstatus"):
        studies.preparation(HTTP(), {"dok_id": "GY03101"})


def test_pdf_only_bill_has_preparation_and_verified_source(tmp_path, monkeypatch):
    from pypdf import PdfWriter
    from pypdf.generic import DictionaryObject, NameObject, DecodedStreamObject

    monkeypatch.setattr(rawstore, "RAW", tmp_path)
    writer = PdfWriter()
    page = writer.add_blank_page(width=600, height=800)
    font = DictionaryObject({NameObject("/Type"): NameObject("/Font"),
                             NameObject("/Subtype"): NameObject("/Type1"),
                             NameObject("/BaseFont"): NameObject("/Helvetica"),
                             NameObject("/Encoding"): NameObject("/WinAnsiEncoding")})
    page[NameObject("/Resources")] = DictionaryObject({
        NameObject("/Font"): DictionaryObject({NameObject("/F1"): font})})
    stream = DecodedStreamObject()
    stream.set_data("BT /F1 12 Tf 10 700 Td (4 Ärendet och dess beredning SOU 2020:5.) Tj ET".encode("latin1"))
    page[NameObject("/Contents")] = writer._add_object(stream)
    output = io.BytesIO()
    writer.write(output)
    pdf = output.getvalue()
    pdf_url = "https://data.riksdagen.se/fil/3355FB3D-3FCA-4839-8122-834C14179B85"

    class HTTP:
        calls = []
        def get(self, url, **kwargs):
            self.calls.append(url)
            response = requests.Response()
            response.status_code, response.url = 200, url
            response._content = pdf if url == pdf_url else json.dumps({"dokumentstatus": {
                "dokument": {"dok_id": "H20329", "rm": "2014/15", "beteckning": "29",
                             "titel": "Test bill", "html": None},
                "dokbilaga": {"bilaga": {"dok_id": "H20329", "titel": "Test bill",
                                          "filtyp": "pdf", "fil_url": pdf_url}}}}).encode()
            return response

    http = HTTP()
    bill = studies.preparation(http, {"dok_id": "H20329"})
    assert bill["has_section"] and bill["references"][0]["key"] == "2020:5"
    assert bill["text_source"]["url"] == pdf_url
    assert bill["text_source"]["sha256"] == rawstore.sha256(pdf)
    assert rawstore.verified_record("riksdagen", "studies/documents/H20329.pdf")
    studies.preparation(http, {"dok_id": "H20329"})
    assert http.calls.count(pdf_url) == 1


@pytest.mark.parametrize("change", ["identity", "host", "ambiguous", "empty"])
def test_pdf_fallback_rejects_unverified_or_unreadable_sources(tmp_path, monkeypatch, change):
    monkeypatch.setattr(rawstore, "RAW", tmp_path)
    head = {"dok_id": "H20329", "titel": "Test bill", "html": None}
    pdf = {"dok_id": "H20329", "titel": "Test bill", "filtyp": "pdf",
           "fil_url": "https://data.riksdagen.se/fil/3355FB3D-3FCA-4839-8122-834C14179B85"}
    if change == "identity":
        head["dok_id"] = "wrong"
    if change == "host":
        pdf["fil_url"] = "https://example.com/fil/3355FB3D-3FCA-4839-8122-834C14179B85"
    files = [pdf, pdf] if change == "ambiguous" else [pdf]

    class HTTP:
        def get(self, url, **kwargs):
            response = requests.Response()
            response.status_code, response.url = 200, url
            response._content = b"not a PDF" if "/fil/" in url else json.dumps({"dokumentstatus": {
                "dokument": head, "dokbilaga": {"bilaga": files}}}).encode()
            return response

    with pytest.raises(ValueError):
        studies.preparation(HTTP(), {"dok_id": "H20329"})
    assert not rawstore.verified_record("riksdagen", "studies/documents/H20329.pdf")


def test_failed_listing_preserves_previous_valid_checkpoint(repair, monkeypatch):
    http, bills, raw = repair
    studies.main()
    checkpoint = raw / "riksdagen/_checkpoints/studies/preparation/201011.json"
    original = checkpoint.read_bytes()

    def fail(*args, **kwargs):
        raise TimeoutError("listing unavailable")

    monkeypatch.setattr(studies, "listing", fail)
    with pytest.raises(TimeoutError):
        studies.main()
    assert checkpoint.read_bytes() == original
    assert rawstore.completed_paths("riksdagen", "studies/preparation/201011",
                                    studies.preparation_request("2010/11"))


def test_legacy_preparation_is_reused_while_coverage_is_migrated(repair):
    http, bills, raw = repair
    studies.main()
    paths = rawstore.completed_paths("riksdagen", "studies/preparation/201011",
                                     studies.preparation_request("2010/11"))
    rawstore.complete("riksdagen", "studies/preparation/201011", paths,
                      {"session": "2010/11", "parser_version": 1})
    http.calls.clear()
    studies.main()
    assert "GY03101" not in http.calls
    assert rawstore.completed_paths("riksdagen", "studies/preparation/201011",
                                    studies.preparation_request("2010/11"))


def test_tax_cold_runner_fails_before_fetch_or_build(tmp_path, monkeypatch):
    monkeypatch.setattr(rawstore, "RAW", tmp_path)
    monkeypatch.setattr(sys, "argv", ["run_taxes.py"])
    calls = []
    monkeypatch.setattr(taxes, "run", calls.append)
    with pytest.raises(RuntimeError, match="Missing parliament upstream"):
        taxes.main()
    assert not calls


def test_tax_build_selects_parents_and_does_not_bypass_failed_gate(monkeypatch):
    monkeypatch.setattr(sys, "argv", ["run_taxes.py", "--skip-fetch"])
    monkeypatch.setattr(taxes, "require_parliament", lambda: None)
    calls = []
    monkeypatch.setattr(taxes, "run", calls.append)
    taxes.main()
    assert calls[0][calls[0].index("--select") + 1] == "+tag:taxes"
    assert "build" in calls[0]


def test_tax_requires_verified_complete_preparation_and_history(repair):
    http, bills, raw = repair
    studies.main()
    vote = rawstore.store("riksdagen", "votes/201011.csv.gz", b"fixture", url="votes")
    report = rawstore.store("riksdagen", "reports/201011-01.json", b"{}", url="reports")
    with pytest.raises(RuntimeError, match="Incomplete or unverified"):
        taxes.require_parliament()
    rawstore.complete("riksdagen", "history/201011", [vote, report], {"session": "2010/11"})
    taxes.require_parliament()
    (raw / "riksdagen/studies/coverage/201011.json").write_text("corrupt")
    with pytest.raises(RuntimeError, match="Incomplete or unverified"):
        taxes.require_parliament()


def test_tax_gate_accepts_verified_century_session_and_rejects_invalid_years(repair):
    http, bills, raw = repair
    studies.main()
    for session, key in (("2010/11", "201011"), ("1999/2000", "19992000")):
        vote = rawstore.store("riksdagen", f"votes/{key}.csv.gz", b"fixture", url="votes")
        report = rawstore.store("riksdagen", f"reports/{key}-01.json", b"{}", url="reports")
        rawstore.complete("riksdagen", f"history/{key}", [vote, report], {"session": session})
    taxes.require_parliament()
    rawstore.invalidate("riksdagen", "history/19992000")
    with pytest.raises(RuntimeError, match="Incomplete or unverified"):
        taxes.require_parliament()
    rawstore.complete("riksdagen", "history/19992000", [vote, report], {"session": "1999/2000"})
    rawstore.store("riksdagen", "votes/19991999.csv.gz", b"fixture", url="votes")
    with pytest.raises(RuntimeError, match="Invalid parliament upstream filename"):
        taxes.require_parliament()
