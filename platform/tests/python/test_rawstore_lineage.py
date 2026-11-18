"""Lineage, conditional refetch and answer checks in the bronze store (rawstore.py)."""
import io
import json
import zipfile

import pytest

from portfolio.storage import rawstore, rawstore_validate as checks


class Response:
    def __init__(self, content=b"", status=200, headers=None):
        self.content, self.status_code, self.headers = content, status, headers or {}

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(self.status_code)


class Server:
    """Answers with a body and an ETag, or 304 when the client already has that ETag."""

    def __init__(self, body):
        self.body, self.etag, self.asked = body, '"v1"', []

    def get(self, url, timeout=None, headers=None):
        self.asked.append(dict(headers or {}))
        if (headers or {}).get("If-None-Match") == self.etag:
            return Response(status=304, headers={"ETag": self.etag})
        return Response(self.body, headers={"ETag": self.etag,
                                            "Last-Modified": "Wed, 18 Nov 2026 10:00:00 GMT"})


@pytest.fixture
def raw(tmp_path, monkeypatch):
    monkeypatch.setattr(rawstore, "RAW", tmp_path)
    monkeypatch.delenv("PORTFOLIO_FULL_REFRESH", raising=False)
    monkeypatch.setenv("GITHUB_RUN_ID", "42")
    monkeypatch.setenv("PORTFOLIO_SUBJECT", "demo")
    return tmp_path


def log(raw, source="s"):
    return [json.loads(line) for line in (raw / source / "_manifest.jsonl").read_text().splitlines()]


def test_a_tagged_file_is_asked_about_and_a_304_downloads_nothing(raw):
    server = Server(b"a,b\n1,2\n")
    rawstore.fetch(server, "s", "t.csv", "https://x/t.csv")
    rawstore.fetch(server, "s", "t.csv", "https://x/t.csv")
    assert server.asked[1] == {"If-None-Match": '"v1"', "If-Modified-Since": "Wed, 18 Nov 2026 10:00:00 GMT"}
    first, second = log(raw)
    assert first["etag"] == '"v1"' and first["source_modified_at"] == "2026-11-18T10:00:00+00:00"
    assert first["run_id"] == "42" and first["subject"] == "demo" and first["changed"]
    assert second["not_modified"] and not second["changed"]
    assert second["sha256"] == first["sha256"] and second["content_changed_at"] == first["content_changed_at"]
    assert rawstore.verified_record("s", "t.csv")


def test_change_time_is_carried_until_the_bytes_change(raw, monkeypatch):
    rawstore.store("s", "a.json", b"[1]", url="u")
    first = log(raw)[-1]["content_changed_at"]
    later = rawstore.datetime.fromisoformat("2030-01-01T00:00:00+00:00")
    monkeypatch.setattr(rawstore, "datetime", type("D", (), {"now": staticmethod(lambda tz=None: later)}))
    rawstore.store("s", "a.json", b"[1]", url="u")
    assert log(raw)[-1]["content_changed_at"] == first
    rawstore.store("s", "a.json", b"[2]", url="u")
    assert log(raw)[-1]["content_changed_at"] == "2030-01-01T00:00:00+00:00"


def test_a_truncated_answer_keeps_the_stored_copy(raw):
    big = json.dumps(list(range(10_000))).encode()
    server = Server(big)
    rawstore.fetch(server, "s", "big.json", "https://x/big.json")
    server.body, server.etag = b"[]", '"v2"'
    with pytest.raises(ValueError, match="the stored copy is kept"):
        rawstore.fetch(server, "s", "big.json", "https://x/big.json")
    assert (raw / "s/big.json").read_bytes() == big


def test_an_html_error_page_is_not_stored_as_data(raw):
    server = Server(b"<!DOCTYPE html><html>Service unavailable</html>")
    with pytest.raises(ValueError, match="HTML page"):
        rawstore.fetch(server, "s", "t.csv", "https://x/t.csv")
    assert not (raw / "s/t.csv").exists()


def test_suffix_checks():
    archive = io.BytesIO()
    with zipfile.ZipFile(archive, "w") as z:
        z.writestr("a.json", "[]")
    checks.default("x.zip")(archive.getvalue())
    with pytest.raises(ValueError):
        checks.default("x.zip")(b"not a zip")
    with pytest.raises(ValueError):
        checks.default("x.jsonl.gz")(b'{"a": 1}\n{broken\n')
    with pytest.raises(ValueError):
        checks.default("x.csv")(b"\n")
    assert checks.default("x.txt") is None


def test_a_file_that_differs_from_its_log_is_found(raw):
    rawstore.store("s", "dir/a.json", b"[1]", url="u")
    assert rawstore.mismatched(["s/dir"]) == []
    (raw / "s/dir/a.json").write_bytes(b"[9]")
    (raw / "s/dir/unlogged.bin").write_bytes(b"x")
    assert rawstore.mismatched(["s/dir"]) == ["s/dir/a.json"]
