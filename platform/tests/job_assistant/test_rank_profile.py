"""rank.py without a readable approved profile: which answers empty the match store, keep it, or fail."""
import json
import sys

import pytest
import requests

from test_match import NOW, profile, store  # noqa: F401  (fixtures)
import rank  # noqa: E402  (on the path through test_match)


class Answer:
    def __init__(self, status, body=None):
        self.status_code, self.body = status, body

    def json(self):
        if isinstance(self.body, Exception):
            raise self.body
        return self.body

    def raise_for_status(self):
        raise requests.HTTPError(str(self.status_code))


def run_main(monkeypatch, answer) -> int:
    """rank.py as the run calls it: its exit code. A crash raises out of here."""
    def get(url, timeout):
        if isinstance(answer, Exception):
            raise answer
        return answer
    monkeypatch.setattr(requests, "get", get)
    monkeypatch.setattr(sys, "argv", ["rank.py"])
    try:
        rank.main()
    except SystemExit as stop:
        return stop.code
    return 0


def saved(store):
    return json.loads((store / "matches.json").read_text(encoding="utf-8"))


UNREAD = [(Answer(503), 503), (Answer(404), 404), (Answer(403), 403),
          (requests.ConnectionError("down"), None)]
FAILED = [(Answer(500), 500), (Answer(502), 502), (Answer(200, ValueError("not JSON")), 200),
          (Answer(200, ["a list"]), 200)]


@pytest.mark.parametrize("answer,status", UNREAD)
def test_an_unread_route_writes_an_empty_store_and_exits_0(store, monkeypatch, answer, status):
    assert run_main(monkeypatch, answer) == 0
    data = saved(store)
    assert data["profile"] is None and data["matches"] == []
    assert data["note"]["skipped"]["status"] == status and data["note"]["skipped"]["at"]


@pytest.mark.parametrize("answer,status", UNREAD)
def test_an_unread_route_keeps_the_last_matches(store, profile, monkeypatch, answer, status):  # noqa: F811
    before = rank.run(profile, None, NOW)
    assert run_main(monkeypatch, answer) == 0
    data = saved(store)
    assert data["matches"] == before["matches"] and data["profile"] == before["profile"]
    assert data["note"]["kept"]["status"] == status


@pytest.mark.parametrize("answer,status", FAILED)
def test_an_unexpected_answer_keeps_the_store_and_exits_1(store, profile, monkeypatch, capsys, answer,  # noqa: F811
                                                          status):
    before = rank.run(profile, None, NOW)
    assert run_main(monkeypatch, answer) == 1
    assert "::error::" in capsys.readouterr().out
    data = saved(store)
    assert data["matches"] == before["matches"] and data["note"]["kept"]["status"] == status


def test_no_approved_profile_empties_the_store(store, profile, monkeypatch):  # noqa: F811
    rank.run(profile, None, NOW)
    assert run_main(monkeypatch, Answer(200, {"approved": None, "versions": []})) == 0
    data = saved(store)
    assert data["profile"] is None and data["matches"] == []
    assert data["note"]["skipped"] == {"reason": "no approved profile", "status": 200, "at": data["note"]["at"]}
