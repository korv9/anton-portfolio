"""platform/ingest/eu_ai_act/ingest_guidance.py: a 403 from the Commission keeps the last version."""
import json
import sys
from pathlib import Path

import pytest
import requests

PLATFORM = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PLATFORM / "lib"))
sys.path.insert(0, str(PLATFORM / "ingest" / "eu_ai_act"))

import ingest_guidance  # noqa: E402
import rawstore  # noqa: E402

PAGES = [{"id": "stored", "url": "https://digital-strategy.ec.europa.eu/en/a"},
         {"id": "never-stored", "url": "https://digital-strategy.ec.europa.eu/en/b"}]


class Forbidden:
    status_code = 403

    def raise_for_status(self):
        raise requests.HTTPError("403 Client Error: Forbidden", response=self)


class Http:
    def get(self, url, timeout=None, headers=None):
        return Forbidden()


@pytest.fixture
def raw(tmp_path, monkeypatch):
    monkeypatch.setattr(rawstore, "RAW", tmp_path)
    monkeypatch.setattr(rawstore, "session", Http)
    return tmp_path


def run(monkeypatch, pages):
    monkeypatch.setattr(ingest_guidance, "GUIDANCE", pages)
    return ingest_guidance.main()


def test_a_403_with_a_stored_version_is_logged_and_not_fatal(raw, monkeypatch):
    kept = rawstore.store_version("eu_ai_act", "guidance/stored.html", b"<html>v1</html>",
                                  url=PAGES[0]["url"])
    assert run(monkeypatch, PAGES[:1]) == 0
    assert kept.read_bytes() == b"<html>v1</html>"
    errors = [r for r in map(json.loads, (raw / "eu_ai_act/_manifest.jsonl").read_text().splitlines())
              if r.get("error")]
    assert [(r["path"], "method" in r) for r in errors] == [("guidance/stored.html", False)]
    assert rawstore.fetch_summary("eu_ai_act", since="2000-01-01")["errors"] == 1


def test_a_403_without_any_stored_version_still_fails(raw, monkeypatch):
    assert run(monkeypatch, PAGES) == 1
