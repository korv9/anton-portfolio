"""The news summary keeps only what its sources carry: cited ids from the input, and parties
the cited items are tagged with."""
import importlib.util
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace

import duckdb
import pytest

spec = importlib.util.spec_from_file_location(
    "summarize_news", Path(__file__).resolve().parents[2] / "publish/summarize_news.py"
)
summarize_news = importlib.util.module_from_spec(spec)
spec.loader.exec_module(summarize_news)

ITEMS = [
    {"id": "a", "parties": ["S"]},
    {"id": "b", "parties": ["M", "KD"]},
]

PREVIOUS = {
    "generated_at": "2026-10-08T12:37:19+00:00",
    "period": {"from": "2026-10-02", "to": "2026-10-08", "days": 7},
    "model": "previous-test-model",
    "headline": "Previous test headline",
    "summary": "Previous test summary",
    "themes": [{"title": "Test theme", "text": "Test text", "parties": ["S"], "item_ids": ["a"]}],
    "by_party": [],
}


@pytest.fixture
def delivery(monkeypatch, tmp_path):
    news = tmp_path / "news.json"
    summary = tmp_path / "news-summaries.json"
    status = tmp_path / "status/summary.json"
    now = datetime.now(timezone.utc)
    items = [
        {"id": "a", "source": "svt", "title": "Test headline A", "summary": "Test feed text",
         "published_at": (now - timedelta(days=1)).isoformat(), "parties": ["S"], "topics": []},
        {"id": "b", "source": "ekot", "title": "Test headline B", "summary": None,
         "published_at": (now - timedelta(days=2)).isoformat(), "parties": ["M", "KD"], "topics": []},
    ]
    news.write_text(json.dumps({"generated_at": now.isoformat(), "items": items}), encoding="utf-8")
    summary.write_bytes((json.dumps(PREVIOUS, indent=2) + "\r\n").encode("utf-8"))
    monkeypatch.setattr(summarize_news, "NEWS", news)
    monkeypatch.setattr(summarize_news, "OUT", summary)
    monkeypatch.setattr(sys, "argv", ["summarize_news.py", "--status-file", str(status)])
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key-never-sent")
    calls = []
    result = {"headline": "Test headline A", "summary": "Test feed text",
              "themes": [{"title": "Test theme", "text": "Test feed text", "parties": ["S"], "item_ids": ["a"]}],
              "by_party": [{"party": "S", "text": "Test feed text", "item_ids": ["a"]}]}
    response = SimpleNamespace(stop_reason="end_turn", model="test-model",
                               content=[SimpleNamespace(type="text", text=json.dumps(result))],
                               usage=SimpleNamespace(input_tokens=400, output_tokens=100))
    context = SimpleNamespace(news=news, summary=summary, status=status, items=items,
                              calls=calls, result=result, response=response, error=None,
                              previous_bytes=summary.read_bytes(), news_bytes=news.read_bytes())

    def create(**kwargs):
        calls.append(kwargs)
        if context.error:
            raise context.error
        return context.response

    def client(**kwargs):
        assert kwargs == {"api_key": "test-key-never-sent", "timeout": 60.0, "max_retries": 0}
        return SimpleNamespace(messages=SimpleNamespace(create=create))

    monkeypatch.setitem(sys.modules, "anthropic", SimpleNamespace(Anthropic=client))
    return context


def preserved(delivery, capsys, reason, code=2):
    assert summarize_news.main() == code
    captured = capsys.readouterr()
    status = json.loads(captured.out)
    assert status == json.loads(delivery.status.read_text(encoding="utf-8"))
    assert status["reason"] == reason
    assert status["exit_code"] == code
    assert status["summary_preserved"] is True
    assert status["active_summary"] == {key: PREVIOUS[key] for key in ("generated_at", "period", "model")}
    assert delivery.summary.read_bytes() == delivery.previous_bytes
    assert delivery.news.read_bytes() == delivery.news_bytes
    return status


def test_ground_drops_unknown_ids_and_untagged_parties():
    result = summarize_news.ground(
        {
            "headline": "h",
            "summary": "s",
            "themes": [
                {"title": "t1", "text": "x", "parties": ["S", "SD"], "item_ids": ["a", "zzz"]},
                {"title": "t2", "text": "y", "parties": ["M"], "item_ids": ["nope"]},
            ],
            "by_party": [
                {"party": "M", "text": "m", "item_ids": ["b"]},
                {"party": "V", "text": "v", "item_ids": ["a"]},
            ],
        },
        ITEMS,
    )
    assert result["themes"] == [
        {"title": "t1", "text": "x", "parties": ["S"], "item_ids": ["a"]}
    ]
    assert result["by_party"] == [{"party": "M", "text": "m", "item_ids": ["b"]}]


def test_no_key_means_no_call(monkeypatch, delivery, capsys):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    assert preserved(delivery, capsys, "no_key", 0)["status"] == "skipped"
    assert delivery.calls == []


def test_success_can_deliver_summary_without_changed_headlines(delivery, capsys):
    assert summarize_news.main() == 0
    status = json.loads(capsys.readouterr().out)
    assert status == json.loads(delivery.status.read_text(encoding="utf-8"))
    summary = json.loads(delivery.summary.read_text(encoding="utf-8"))
    assert status["status"] == "generated"
    assert status["summary_preserved"] is False
    assert summary["generated_at"] != PREVIOUS["generated_at"]
    assert summary["period"] == {"from": delivery.items[1]["published_at"][:10],
                                 "to": delivery.items[0]["published_at"][:10], "days": 7}
    assert status["active_summary"]["generated_at"] == summary["generated_at"]
    assert status["active_summary"]["period"] == summary["period"]
    assert summary["model"] == "test-model"
    assert summary["items_considered"] == 2
    assert summary["themes"] == delivery.result["themes"]
    assert delivery.news.read_bytes() == delivery.news_bytes
    request = delivery.calls[0]
    supplied = [json.loads(line) for line in request["messages"][0]["content"].splitlines()[1:]]
    assert supplied[0]["id"] == "a" and supplied[1]["summary"] == ""
    assert request["output_config"]["format"]["schema"] == summarize_news.SCHEMA


@pytest.mark.parametrize("reason", ["max_tokens", "refusal", "pause_turn"])
def test_model_stop_keeps_dated_previous_summary(delivery, capsys, reason):
    delivery.response.stop_reason = reason
    delivery.response.content = [SimpleNamespace(type="text", text='{"headline":"Partial')]
    status = preserved(delivery, capsys, reason if reason != "pause_turn" else "unexpected_stop")
    assert status["stop_reason"] == reason
    assert status["status"] == "degraded"


class MockAPIError(Exception):
    status_code = 503


@pytest.mark.parametrize("error", [ConnectionError("test secret body"), TimeoutError("test timeout"),
                                  MockAPIError("test secret body")])
def test_api_and_network_errors_keep_previous_summary(delivery, capsys, error):
    delivery.error = error
    status = preserved(delivery, capsys, "api_error")
    assert status["error_type"] == type(error).__name__
    assert status["http_status"] == getattr(error, "status_code", None)
    assert "test secret body" not in json.dumps(status)


@pytest.mark.parametrize("text", ["", "not json", '{"headline":"Partial', "{}", "[]",
                                 json.dumps({**PREVIOUS, "headline": " "})])
def test_empty_and_invalid_responses_keep_previous_summary(delivery, capsys, text):
    delivery.response.content = [SimpleNamespace(type="text", text=text)]
    preserved(delivery, capsys, "invalid_response")


@pytest.mark.parametrize("field,value", [("headline", " "), ("summary", ""), ("themes", [])])
def test_valid_json_with_empty_required_text_is_rejected(delivery, capsys, field, value):
    delivery.result[field] = value
    delivery.response.content[0].text = json.dumps(delivery.result)
    preserved(delivery, capsys, "invalid_response")


@pytest.mark.parametrize("mutation", ["unknown_id", "mixed_ids", "untagged_party", "unknown_party_note"])
def test_ungrounded_responses_keep_previous_summary(delivery, capsys, mutation):
    theme = delivery.result["themes"][0]
    if mutation == "unknown_id":
        theme["item_ids"] = ["not-in-input"]
    elif mutation == "mixed_ids":
        theme["item_ids"] = ["a", "not-in-input"]
    elif mutation == "untagged_party":
        theme["parties"] = ["V"]
    else:
        delivery.result["by_party"][0]["party"] = "V"
    delivery.response.content[0].text = json.dumps(delivery.result)
    preserved(delivery, capsys, "ungrounded_response")


def test_no_recent_items_preserves_summary_without_api_call(delivery, capsys):
    delivery.news.write_text(json.dumps({"items": []}), encoding="utf-8")
    delivery.news_bytes = delivery.news.read_bytes()
    preserved(delivery, capsys, "no_recent_items", 0)
    assert delivery.calls == []


def test_missing_sdk_is_optional(delivery, monkeypatch, capsys):
    monkeypatch.setitem(sys.modules, "anthropic", None)
    preserved(delivery, capsys, "sdk_unavailable")


@pytest.mark.parametrize("missing", [False, True])
def test_local_input_failure_is_fatal(delivery, capsys, missing):
    if missing:
        delivery.news.unlink()
    else:
        delivery.news.write_text("broken json", encoding="utf-8")
    assert summarize_news.main() == 1
    status = json.loads(capsys.readouterr().out)
    assert status["status"] == "failed" and status["reason"] == "input_error"
    assert delivery.summary.read_bytes() == delivery.previous_bytes
    assert delivery.calls == []


def test_failed_summary_write_preserves_previous_bytes(delivery, monkeypatch, capsys):
    write = summarize_news.write_bytes_retrying

    def fail_summary(path, payload):
        if path == delivery.summary:
            raise PermissionError("test output failure")
        return write(path, payload)

    monkeypatch.setattr(summarize_news, "write_bytes_retrying", fail_summary)
    assert preserved(delivery, capsys, "output_error", 1)["status"] == "failed"


def test_failed_status_write_is_fatal_and_reports_stdout(delivery, monkeypatch, capsys):
    monkeypatch.delenv("ANTHROPIC_API_KEY")

    def fail_status(path, payload):
        raise PermissionError("test status failure")

    monkeypatch.setattr(summarize_news, "write_bytes_retrying", fail_status)
    assert summarize_news.main() == 1
    status = json.loads(capsys.readouterr().out)
    assert status["reason"] == "status_output_error" and status["exit_code"] == 1
    assert delivery.summary.read_bytes() == delivery.previous_bytes


def test_failure_without_previous_summary_creates_no_placeholder(delivery, capsys):
    delivery.summary.unlink()
    delivery.response.stop_reason = "max_tokens"
    assert summarize_news.main() == 2
    status = json.loads(capsys.readouterr().out)
    assert status["active_summary"] is None and status["summary_preserved"] is False
    assert not delivery.summary.exists()


@pytest.mark.parametrize("args", [["--days", "0"], ["--days", "bad"], ["--unknown"]])
def test_cli_errors_are_fatal_not_optional(monkeypatch, args):
    monkeypatch.setattr(sys, "argv", ["summarize_news.py", *args])
    assert summarize_news.main() == 1


def test_status_path_cannot_replace_news_or_summary(delivery, monkeypatch):
    for path in (delivery.news, delivery.summary):
        monkeypatch.setattr(sys, "argv", ["summarize_news.py", "--status-file", str(path)])
        assert summarize_news.main() == 1
    assert delivery.summary.read_bytes() == delivery.previous_bytes
    assert delivery.news.read_bytes() == delivery.news_bytes


def test_export_continues_when_optional_summary_fails(delivery, monkeypatch, tmp_path, capsys):
    spec = importlib.util.spec_from_file_location(
        "export_news", Path(__file__).resolve().parents[2] / "publish/export_news.py")
    export = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(export)
    database = tmp_path / "news.duckdb"
    with duckdb.connect(str(database)) as con:
        con.execute("create schema gold; create schema seeds")
        con.execute("""create table gold.fct_news_item (
            item_id varchar, source varchar, title varchar, summary varchar, url varchar,
            published_at timestamptz, parties varchar[], topics varchar[],
            is_political boolean, first_seen timestamptz)""")
        for item in delivery.items:
            con.execute("insert into gold.fct_news_item values (?, ?, ?, ?, ?, ?, ?, ?, true, now())",
                        [item["id"], item["source"], item["title"], item["summary"],
                         "https://example.invalid/test-article", item["published_at"], item["parties"], []])
        con.execute("create table seeds.news_topics (topic varchar, name_sv varchar, name_en varchar)")
        con.execute("""create view gold.fct_news_item_party as
            select item_id, unnest(parties) as party from gold.fct_news_item""")
        con.execute("""create table gold.mart_news_fetch_status (source varchar,
            last_fetch timestamptz, last_success timestamptz, last_status integer,
            last_error varchar, fetches integer, failed integer)""")
        con.execute("insert into gold.mart_news_fetch_status values ('svt', now(), now(), 200, NULL, 1, 0)")
    monkeypatch.setattr(export, "DATABASE", database)
    monkeypatch.setattr(export, "OUT", delivery.news)
    delivery.news.write_text('{"items":[]}', encoding="utf-8")
    export.main()
    capsys.readouterr()
    delivery.news_bytes = delivery.news.read_bytes()
    assert len(json.loads(delivery.news_bytes)["items"]) == 2
    delivery.response.stop_reason = "max_tokens"
    status = preserved(delivery, capsys, "max_tokens")
    # The workflow accepts exactly 0 or 2, so the exported base data can be delivered.
    assert status["exit_code"] in (0, 2)
    export.main()
    assert len(json.loads(delivery.news.read_text(encoding="utf-8"))["items"]) == 2
    assert delivery.summary.read_bytes() == delivery.previous_bytes
