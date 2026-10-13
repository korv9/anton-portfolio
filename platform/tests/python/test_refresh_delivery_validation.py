"""Reject plausible corrupt deliveries while accepting sparse and archived data."""
import copy
import importlib.util
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import pytest

SPEC = importlib.util.spec_from_file_location(
    "refresh_validation", Path(__file__).resolve().parents[2] / "publish/validate_refresh_delivery.py")
validation = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(validation)
NOW = datetime(2026, 10, 13, 2, tzinfo=timezone.utc)


@pytest.fixture
def market():
    return {
        "generated_at": "2026-10-13T01:00:00Z", "years": [2026], "latest_year": 2026,
        "ytd_months": 9, "last_month": "2026-09", "fields": [{"id": "F1", "name": "Test field", "groups": 1}],
        "monthly": {"all": [["2026-08", 100, 150], ["2026-09", 120, 170]],
                    "F1": [["2026-08", 60, 70], ["2026-09", 80, 100]]},
        # No row for 12 October: zero ads does not imply an uncollected day.
        "daily": {"all": [["2026-10-10", 5, 8], ["2026-10-11", 3, 4]],
                  "F1": [["2026-10-10", 2, 3]]},
        "occupations": [{"id": "G1", "ads": {"2026": 140}, "ytd": {"2026": 140}}],
        "regions": [{"region": "Test county", "ads": {"all": {"2026": 220}, "F1": {"2026": 140}},
                     "ytd": {"all": {"2026": 220}, "F1": {"2026": 140}}}],
        "conditions": {"2026": {"all": {"employment": {"Permanent": 220}, "hours": {"Full": 220},
                                        "experience": {"yes": 120, "no": 100}},
                                 "F1": {"employment": {"Permanent": 140}, "hours": {"Full": 140},
                                        "experience": {"yes": 90, "no": 50}}}},
        "archives": [{"archive": "2026-Q3", "ads": 220}], "preliminary": ["2026-09"],
    }


@pytest.fixture
def headlines():
    return {"generated_at": "2026-10-13T01:00:00Z", "days": 60,
            "sources": {"svt": {"name": "SVT"}},
            "items": [{"id": "svt:test-a", "source": "svt", "parties": ["S"],
                       "published_at": "2026-10-12T12:00:00Z", "title": "Test headline"}]}


@pytest.fixture
def summary():
    return {"generated_at": "2026-10-13T01:05:00Z", "model": "test-model",
            "period": {"from": "2026-10-12", "to": "2026-10-12", "days": 7},
            "headline": "Test headline", "summary": "Test summary",
            "themes": [{"title": "Test theme", "text": "Test text", "parties": ["S"],
                        "item_ids": ["svt:test-a"]}],
            "by_party": [{"party": "S", "text": "Test text", "item_ids": ["svt:test-a"]}]}


def set_path(data, path, value):
    for key in path[:-1]:
        data = data[key]
    data[path[-1]] = value


def test_sparse_jobs_and_zero_day_with_fresh_watermark_are_valid(market):
    state = {"complete_from": "2026-10-01", "fetched_until": "2026-10-13T00:00:00"}
    result = validation.jobs(market, NOW, state)
    assert result["stream_coverage"]["last_complete_day"] == "2026-10-12"
    assert market["daily"]["all"][-1][0] == "2026-10-11"


@pytest.mark.parametrize("path,value", [
    (("monthly", "all", 0, 1), -1),
    (("monthly", "all", 0, 2), 1.5),
    (("daily", "all", 0, 1), True),
    (("daily", "F1", 0, 1), 6),
    (("monthly", "F1", 0, 2), 151),
    (("latest_year",), 2027),
    (("ytd_months",), 10),
    (("last_month",), "2026-08"),
    (("years",), [2026, 2026]),
    (("monthly", "all", 1, 0), "2026-11"),
    (("daily", "all", 1, 0), "2026-10-14"),
    (("daily", "all", 1, 0), "2026-10-13"),
    (("occupations", 0, "ads", "2026"), -5),
    (("occupations", 0, "ads"), {"2027": 140}),
    (("occupations", 0, "ytd", "2026"), 141),
    (("regions", 0, "ads", "F1", "2026"), 221),
    (("regions", 0, "ytd", "F1", "2026"), 221),
    (("conditions", "2026", "F1", "hours", "Full"), 221),
    (("conditions", "2026", "all", "hours", "Full"), float("nan")),
    (("archives", 0, "ads"), float("inf")),
])
def test_jobs_rejects_false_counts_and_inconsistent_periods(market, path, value):
    set_path(market, path, value)
    with pytest.raises(ValueError):
        validation.jobs(market, NOW)


@pytest.mark.parametrize("section,field", [("monthly", "all"), ("monthly", "F1"), ("daily", "all")])
@pytest.mark.parametrize("duplicate", [True, False])
def test_jobs_rejects_duplicates_and_unsorted_dates(market, section, field, duplicate):
    rows = market[section][field]
    if duplicate:
        rows.append(copy.deepcopy(rows[-1]))
    else:
        rows.reverse()
    with pytest.raises(ValueError, match="duplicate or unordered"):
        validation.jobs(market, NOW)


def test_duplicate_occupation_cannot_double_totals(market):
    market["occupations"].append(copy.deepcopy(market["occupations"][0]))
    with pytest.raises(ValueError, match="duplicate id"):
        validation.jobs(market, NOW)


@pytest.mark.parametrize("state", [
    {},
    {"complete_from": "2026-10-01", "fetched_until": "2026-10-12T23:59:59"},
    {"complete_from": "2026-10-13", "fetched_until": "2026-10-13T00:00:00"},
    {"complete_from": "2026-10-01", "fetched_until": "2026-10-13T08:00:00"},
    {"complete_from": "2026-10-01", "fetched_until": "not a timestamp"},
    {"complete_from": "2026-10-01", "fetched_until": "2026-10-13T00:00:00", "last_complete_day": "2026-10-11"},
])
def test_invalid_stale_or_future_watermark_fails(market, state):
    with pytest.raises((ValueError, KeyError)):
        validation.jobs(market, NOW, state)


def test_stockholm_day_boundary_not_utc_or_last_positive_row(market):
    now = datetime(2026, 10, 12, 22, 5, tzinfo=timezone.utc)  # 13 October, 00:05 Stockholm
    state = {"complete_from": "2026-10-01", "fetched_until": "2026-10-12T22:00:00Z"}
    assert validation.stream_coverage(state, now)["last_complete_day"] == "2026-10-12"


def test_missing_all_date_does_not_create_zero_or_reject_sparse_fields(market):
    market["daily"]["F1"].append(["2026-10-12", 0, 0])
    before = copy.deepcopy(market)
    validation.jobs(market, NOW)
    assert market == before


def test_news_summary_is_valid_and_keeps_original_dates(headlines, summary):
    before = copy.deepcopy(summary)
    result = validation.news(headlines, summary, NOW)
    assert result["summary_period"] == summary["period"]
    assert result["warnings"] == [] and summary == before


@pytest.mark.parametrize("path,value", [
    (("items", 0, "source"), "unknown"),
    (("items", 0, "published_at"), "2026-10-14T00:00:00Z"),
    (("items", 0, "published_at"), "2026-10-12T12:00:00"),
    (("items", 0, "published_at"), "2026-02-30T12:00:00Z"),
    (("items", 0, "published_at"), None),
])
def test_news_rejects_bad_sources_and_dates(headlines, path, value):
    set_path(headlines, path, value)
    with pytest.raises((ValueError, AttributeError)):
        validation.news(headlines, None, NOW)


def test_news_rejects_duplicate_article_id(headlines):
    headlines["items"].append(copy.deepcopy(headlines["items"][0]))
    with pytest.raises(ValueError, match="duplicate id"):
        validation.news(headlines, None, NOW)


@pytest.mark.parametrize("path,value", [
    (("themes", 0, "item_ids"), ["svt:invented"]),
    (("themes", 0, "parties"), ["V"]),
    (("by_party", 0, "party"), "V"),
    (("period", "from"), "2026-10-13"),
    (("period", "to"), "2026-10-14"),
    (("period", "days"), 0),
    (("headline",), " "),
    (("summary",), ""),
])
def test_current_summary_must_be_grounded(headlines, summary, path, value):
    set_path(summary, path, value)
    with pytest.raises(ValueError):
        validation.news(headlines, summary, NOW)


def test_old_summary_ids_outside_export_window_are_reported_not_discarded(headlines, summary):
    summary["generated_at"] = "2026-07-08T12:00:00Z"
    summary["period"] = {"from": "2026-07-02", "to": "2026-07-08", "days": 7}
    for entry in summary["themes"] + summary["by_party"]:
        entry["item_ids"] = ["svt:older-archived-id"]
    before = copy.deepcopy(summary)
    result = validation.news(headlines, summary, NOW)
    assert "archived-item verification" in result["warnings"][0]
    assert summary == before and result["summary_period"] == before["period"]


def test_known_id_in_old_summary_still_needs_original_period(headlines, summary):
    summary["generated_at"] = "2026-07-08T12:00:00Z"
    summary["period"] = {"from": "2026-07-02", "to": "2026-07-08", "days": 7}
    with pytest.raises(ValueError, match="outside original period"):
        validation.news(headlines, summary, NOW)


def test_diva_export_shape_has_cluster_ids_but_no_point_ids():
    data = {"clusters": [{"id": 0, "size": 2}],
            "points": [{"x": 0.2, "y": -0.7, "c": 0, "t": "Test thesis"}]}
    assert "no record identifier" in validation.diva(data)["warnings"][0]


@pytest.mark.parametrize("data", [
    {"clusters": [{"id": 0}, {"id": 0}], "points": []},
    {"clusters": [{"id": 0}], "points": [{"x": float("inf"), "y": 0, "c": 0}]},
    {"clusters": [{"id": 0}], "points": [{"x": "0.1", "y": 0, "c": 0}]},
    {"clusters": [{"id": 0}], "points": [{"x": 0.1, "y": 0, "c": 3}]},
])
def test_diva_rejects_invalid_coordinates_and_cluster_ids(data):
    with pytest.raises(ValueError):
        validation.diva(data)


def write(root, path, data):
    target = root / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(data), encoding="utf-8")
    return target


def test_cli_reads_delivery_root_and_optional_state(tmp_path, market, monkeypatch, capsys):
    validate = validation.validate_delivery
    monkeypatch.setattr(validation, "validate_delivery", lambda group, root, stream_state=None:
                        validate(group, root, stream_state, now=NOW))
    write(tmp_path, "jobs/market.json", market)
    state = write(tmp_path, "stream-state.json", {"complete_from": "2026-10-01", "fetched_until": "2026-10-01T00:00:00"})
    monkeypatch.setattr(sys, "argv", ["validate", "--group", "jobs", "--root", str(tmp_path), "--stream-state", str(state)])
    assert validation.main() == 1
    assert json.loads(capsys.readouterr().out)["status"] == "failed"
    monkeypatch.setattr(sys, "argv", ["validate", "--group", "jobs", "--root", str(tmp_path)])
    assert validation.main() == 0
    assert json.loads(capsys.readouterr().out)["status"] == "validated"


def test_news_without_optional_summary_is_publishable(tmp_path, headlines):
    write(tmp_path, "parliament/news.json", headlines)
    assert validation.validate_delivery("news", tmp_path, now=NOW)["warnings"] == []


def test_cli_failure_for_missing_delivery_has_json_status(tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(sys, "argv", ["validate", "--group", "diva", "--root", str(tmp_path)])
    assert validation.main() == 1
    assert json.loads(capsys.readouterr().out)["status"] == "failed"
