"""Small source fixtures exercise cold start, daily reuse and interrupted collections."""
import copy
import json
import sys
from datetime import date
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "ingest/taxes"))
import taxes_ingest as taxes
import rawstore
import pxweb
import history_ingest as history
import studies_ingest as studies


class Response:
    def __init__(self, value):
        self.content = json.dumps(value).encode()
        self.status_code = 200

    def raise_for_status(self):
        pass

    def json(self):
        return json.loads(self.content)


class Rowstore:
    def __init__(self):
        self.calls = []
        self.fail_offset = None
        self.short_offset = None
        self.revision = 1

    def get(self, url, **kwargs):
        query = parse_qs(urlsplit(url).query)
        offset = int(query["_offset"][0])
        self.calls.append((query.get("år", ["rates"])[0], offset))
        if offset == self.fail_offset:
            raise TimeoutError("interrupted page")
        rows = [{"id": i, "revision": self.revision} for i in range(offset, min(offset + 2, 5))]
        if offset == self.short_offset:
            rows.pop()
        return Response({"resultCount": 5, "results": rows})


@pytest.fixture
def raw(tmp_path, monkeypatch):
    monkeypatch.setattr(rawstore, "RAW", tmp_path)
    monkeypatch.setattr(rawstore.time, "sleep", lambda _: None)
    monkeypatch.delenv("PORTFOLIO_FULL_REFRESH", raising=False)
    monkeypatch.setattr(taxes, "PAGE", 2)
    return tmp_path


def test_second_run_reuses_complete_history_updates_current_and_resumes_after_failure(raw):
    http = Rowstore()
    def run(year):
        return taxes.rowstore_pages(http, "tables", f"withholding/{year}", {"år": str(year)},
                                    max_age_days=90 if year < date.today().year else 0)
    old, current = date.today().year - 1, date.today().year
    assert run(old) == run(current) == 5
    assert len(http.calls) == 6
    http.calls.clear()
    http.revision = 2
    assert run(old) == run(current) == 5
    assert http.calls == [(str(current), 0), (str(current), 2), (str(current), 4)]
    assert json.loads((raw / f"skatteverket/withholding/{old}-000.json").read_text())["results"][0]["revision"] == 1
    assert json.loads((raw / f"skatteverket/withholding/{current}-000.json").read_text())["results"][0]["revision"] == 2

    interrupted = old - 1
    http.fail_offset = 2
    with pytest.raises(TimeoutError):
        run(interrupted)
    assert not (raw / f"skatteverket/_checkpoints/withholding/{interrupted}.json").exists()
    http.calls.clear()
    http.fail_offset = None
    run(old)  # A completed year survives failure in another year.
    assert run(interrupted) == 5
    assert http.calls == [(str(interrupted), 0), (str(interrupted), 2), (str(interrupted), 4)]
    http.calls.clear()
    run(interrupted)
    assert not http.calls


def test_force_corruption_changed_request_and_short_pages_cannot_hit_cache(raw, monkeypatch):
    http = Rowstore()
    target = "withholding/2020"
    def run(filters=None):
        return taxes.rowstore_pages(http, "tables", target, filters or {}, max_age_days=90)
    run()
    http.calls.clear()
    monkeypatch.setenv("PORTFOLIO_FULL_REFRESH", "1")
    run()
    assert len(http.calls) == 3
    monkeypatch.delenv("PORTFOLIO_FULL_REFRESH")
    http.calls.clear()
    path = raw / "skatteverket/withholding/2020-001.json"
    path.write_text("corrupt")
    run()
    assert len(http.calls) == 3
    http.short_offset = 2
    with pytest.raises(ValueError, match="Incomplete"):
        run({"new": "selection"})
    # The old completion seal cannot certify modified or malformed pages.
    assert rawstore.completed_paths("skatteverket", target,
                                   {"dataset": "tables", "filters": {}, "page_size": 2}) is None


def test_pxweb_only_downloads_recent_periods_again_and_does_not_store_partial_answers(raw):
    current = date.today().year
    class PxWeb:
        def __init__(self):
            self.posts = []
            self.partial = False
        def get(self, url, **kwargs):
            return Response({"variables": [
                {"code": "Region", "values": ["00"]},
                {"code": "Tid", "time": True, "values": [str(current - 3), str(current)]},
            ]})
        def post(self, url, json, **kwargs):
            self.posts.append(copy.deepcopy(json))
            periods = json["query"][1]["selection"]["values"]
            data = [{"key": ["00", year], "values": ["1"]} for year in periods]
            return Response({"columns": [{"code": "value"}], "data": [] if self.partial else data})
    http = PxWeb()
    paths = pxweb.download_table(http, "scb", "test", "https://test/table", pause=0)
    assert len(paths) == len(http.posts) == 2
    pxweb.download_table(http, "scb", "test", "https://test/table", pause=0)
    assert len(http.posts) == 3
    assert http.posts[-1]["query"][1]["selection"]["values"] == [str(current)]
    http.partial = True
    original = paths[-1].read_bytes()
    with pytest.raises(ValueError, match="Incomplete PxWeb"):
        pxweb.download_table(http, "scb", "test", "https://test/table", pause=0)
    assert paths[-1].read_bytes() == original


def test_missing_provenance_truncated_manifest_and_expired_policy(raw, monkeypatch):
    path = raw / "source/data.json"
    path.parent.mkdir()
    path.write_text("{}")
    assert not rawstore.reusable("source", "data.json", "url")
    rawstore.store("source", "data.json", b"{}", url="url")
    assert rawstore.reusable("source", "data.json", "url")
    manifest = raw / "source/_manifest.jsonl"
    with manifest.open("a") as f:
        f.write('{"path":')
    rawstore.store("source", "next.json", b"{}", url="next")
    assert all(json.loads(line) for line in manifest.read_text().splitlines())
    records = [json.loads(line) for line in manifest.read_text().splitlines()]
    records[0]["fetched_at"] = "2000-01-01T00:00:00+00:00"
    manifest.write_text("".join(json.dumps(r) + "\n" for r in records))
    assert not rawstore.reusable("source", "data.json", "url")


def test_study_listing_requires_every_page_and_each_series_has_own_seal(raw):
    class Riksdag:
        fail_page = 2
        calls = []
        def get(self, url, **kwargs):
            page = int(parse_qs(urlsplit(url).query)["p"][0])
            self.calls.append(page)
            if page == self.fail_page:
                raise TimeoutError("page")
            return Response({"dokumentlista": {"@sidor": "2", "dokument": [{"dok_id": str(page)}]}})
    http = Riksdag()
    with pytest.raises(TimeoutError):
        studies.listing(http, "sou", "2020", "sou/2020", 90)
    http.fail_page = None
    assert len(studies.listing(http, "sou", "2020", "sou/2020", 90)) == 2
    http.calls.clear()
    assert len(studies.listing(http, "sou", "2020", "sou/2020", 90)) == 2
    assert not http.calls
    studies.listing(http, "ds", "2020", "ds/2020", 90)
    assert http.calls == [1, 2]


def test_partial_bill_preparation_is_saved_but_never_sealed_or_skipped(raw, monkeypatch):
    monkeypatch.setattr(studies, "FIRST_STUDY_YEAR", date.today().year + 1)
    monkeypatch.setattr(studies, "sessions_until_now", lambda: ["2020/21", "2025/26", "2026/27"])
    monkeypatch.setattr(studies.rawstore, "session", lambda: object())
    monkeypatch.setattr(sys, "argv", ["studies_ingest.py"])
    calls, fail = [], {"2020/21-b"}
    def listing(http, kind, period, target, max_age_days=0):
        bills = [{"dok_id": period + suffix, "beteckning": "1"} for suffix in ("-a", "-b")]
        path = rawstore.store("riksdagen", f"studies/{target}-01.json",
                              json.dumps({"dokumentlista": {"dokument": bills}}).encode(), url="listing")
        rawstore.complete("riksdagen", "studies/listing/" + target, [path],
                          {"doc_type": kind, "period": period, "sort": "datum", "size": 500})
        return bills
    def preparation(http, bill):
        calls.append(bill["dok_id"])
        if bill["dok_id"] in fail:
            raise TimeoutError("bill")
        return {"prop_id": bill["dok_id"], "reports": [{"report_id": "r"}], "references": []}
    monkeypatch.setattr(studies, "listing", listing)
    monkeypatch.setattr(studies, "preparation", preparation)
    with pytest.raises(RuntimeError, match="Incomplete preparation"):
        studies.main()
    assert studies.stored_preparation("2020/21").keys() == {"2020/21-a"}
    request = {"session": "2020/21", "parser_version": 1}
    assert rawstore.completed_paths("riksdagen", "studies/preparation/202021", request) is None
    fail.clear()
    calls.clear()
    studies.main()
    assert "2020/21-a" not in calls and "2020/21-b" in calls
    assert rawstore.completed_paths("riksdagen", "studies/preparation/202021", request)
    calls.clear()
    studies.main()
    assert not calls


def test_payload_validation_rejects_api_error_and_preserves_last_valid_bulk_file(raw):
    class Bulk:
        content = b"REF_AREA,OBS_VALUE\nSWE,123\n"
        calls = 0
        def get(self, url, **kwargs):
            self.calls += 1
            class Result:
                content = self.content
                def raise_for_status(self):
                    pass
            return Result()
    http = Bulk()
    path = rawstore.fetch(http, "oecd", "test.csv.gz", "url", max_age_days=7,
                          validate=taxes.validate_oecd)
    rawstore.fetch(http, "oecd", "test.csv.gz", "url", max_age_days=7,
                   validate=taxes.validate_oecd)
    assert http.calls == 1
    original = path.read_bytes()
    http.content = b"<error>try again</error>"
    with pytest.raises(ValueError, match="Incomplete OECD"):
        rawstore.fetch(http, "oecd", "test.csv.gz", "url", validate=taxes.validate_oecd)
    assert path.read_bytes() == original


def test_a_listing_with_missing_documents_is_not_complete(raw):
    class HTTP:
        def get(self, url, **kwargs):
            return Response({"dokumentlista": {"@sidor": "1", "@traffar": "2",
                                                "dokument": [{"dok_id": "a"}]}})
    with pytest.raises(ValueError, match="Incomplete study listing"):
        studies.listing(HTTP(), "sou", "2020", "sou/2020", 90)
    assert not (raw / "riksdagen/_checkpoints/studies/listing/sou/2020.json").exists()


def test_kolada_reuses_only_terminated_historical_blocks_and_rejects_error_pages(raw, monkeypatch):
    sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "ingest/kolada"))
    import kolada_ingest as kolada
    class HTTP:
        data_calls = []
        broken = False
        def get(self, url, **kwargs):
            if "/data/" not in url:
                return Response({"values": []})
            self.data_calls.append(url)
            if self.broken:
                return Response({"error": "retry"})
            return Response({"values": [{"period": "2000", "values": []}], "next_url": None})
    http = HTTP()
    monkeypatch.setattr(kolada, "selected_kpis", lambda: ["K1"])
    monkeypatch.setattr(kolada, "session", lambda: http)
    monkeypatch.setattr(sys, "argv", ["kolada_ingest.py"])
    kolada.main()
    assert len(http.data_calls) == 2
    http.data_calls.clear()
    kolada.main()
    assert len(http.data_calls) == 1 and "/year/2015," in http.data_calls[0]
    monkeypatch.setenv("PORTFOLIO_FULL_REFRESH", "1")
    http.broken = True
    with pytest.raises(ValueError, match="Incomplete Kolada"):
        kolada.main()
    assert not (raw / "kolada/_checkpoints/K1/block-1990.json").exists()
