"""The archive-based job exports on small fixtures: periods, technology shares and rising terms."""
import sys
from datetime import date
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "platform/nlp"))
sys.path.insert(0, str(ROOT / "platform/publish"))

import export_job_history as history  # noqa: E402
import rising_terms as rt  # noqa: E402


def months(first: date, count: int) -> list[date]:
    return [rt.add_months(first, k) for k in range(count)]


def test_windows_follow_the_latest_complete_month_and_need_all_24():
    complete = months(date(2023, 6, 1), 31)  # 2023-06 .. 2025-12
    assert rt.windows(complete) == (date(2024, 1, 1), date(2025, 1, 1), date(2026, 1, 1))
    assert rt.windows([m for m in complete if m != date(2024, 7, 1)]) is None
    assert rt.windows(complete[:20]) is None and rt.windows([]) is None


def term(word, recent, before, employers=12, own_name=0, n=None):
    return ("term", word, n or len(word.split()), recent, before, employers, own_name)


def test_rank_drops_stopwords_numbers_employer_and_place_names_and_caps_each_side():
    totals = [("total", "recent", 1, 100_000, 0, 0, 0), ("total", "before", 1, 100_000, 0, 0, 0),
              ("total", "recent", 2, 90_000, 0, 0, 0), ("total", "before", 2, 90_000, 0, 0, 0)]
    found = totals + [
        term("och dbt", 500, 10),            # starts with a stopword
        term("2024", 500, 10),               # a number
        term("acmesoft", 500, 10, own_name=200),  # mostly in the employer's own name
        term("göteborg", 500, 10),           # a place
        term("göteborgsområdet", 500, 10),   # begins with a place of six letters or more
        term("mora", 10, 500),               # a place, too short to be a prefix but whole
        term("moraliskt", 500, 10),          # not a place: mora has four letters
        term("python", 1_000, 1_000),        # steady: no side
        term("hadoop", 10, 500),
    ] + [term(f"ord{chr(97 + i)}{chr(97 + j)}", 300 + i * 26 + j, 5) for i in range(3) for j in range(26)]
    ranked = rt.rank(found, places={"göteborg", "mora", "stockholms", "län"})
    rising = [r["term"] for r in ranked["rising"]]
    assert len(rising) == rt.TOP == 30
    assert "moraliskt" in {r["term"] for r in rt.rank(found[:11], {"göteborg", "mora"})["rising"]}
    assert not {"och dbt", "2024", "acmesoft", "göteborg", "göteborgsområdet", "mora", "python"} & set(rising)
    assert ranked["dropped"] == {"stopword_or_number": 2, "employer_name": 1, "place_name": 3}
    assert [r["term"] for r in ranked["falling"]] == ["hadoop"]
    top = ranked["rising"][0]
    assert top["recent_uses"] > top["before_uses"] and top["employers"] == 12 and top["z"] >= rt.Z_MIN
    assert ranked["totals"] == {"before_phrases": 90_000, "before_words": 100_000,
                                "recent_phrases": 90_000, "recent_words": 100_000}


def gold(tmp_path):
    con = duckdb.connect(str(tmp_path / "history.duckdb"))
    con.execute("create schema gold")
    con.execute("""create table gold.mart_job_ads_periods as select * from (values
        ('week', date '2025-12-22', 'all', 40, 7, 7, true),
        ('week', date '2025-12-29', 'all', 9, 3, 7, false),
        ('month', date '2025-12-01', 'all', 60, 31, 31, true)) as t(
        period_kind, period_start, role_family, ads, days_covered, days_in_period, complete)""")
    con.execute("""create table gold.mart_skill_trends_monthly as select * from (values
        (date '2025-11-01', 'Data Engineer', 'dbt', true, 40, 20, 9, 0.5, 10, 0.25, 25.0, true),
        (date '2025-12-01', 'Data Engineer', 'dbt', true, 40, 20, 9, 0.5, 10, 0.25, 25.0, true),
        (date '2025-12-01', 'Data Engineer', 'Rust', true, 40, 3, 2, 0.075, 1, 0.025, 5.0, false),
        (date '2025-12-01', 'Data Engineer', 'SQL', true, 40, 30, 12, 0.75, 30, 0.75, 0.0, true),
        (date '2026-01-01', 'Data Engineer', 'dbt', false, null, null, null, null, 10, 0.25, null, false))
        as t(publication_month, role_family, skill, is_complete, total_ads, ads_with_skill,
             unique_employers, skill_share, previous_year_skill_ads, previous_year_share,
             share_yoy_pp, sufficient_volume)""")
    con.execute("""create table gold.mart_job_trends_monthly as select * from (values
        (date '2025-12-01', 'Data Engineer', 40)) as t(publication_month, role_family, previous_year_ads)""")
    return con


def test_periods_keep_incomplete_weeks_marked_and_name_the_latest_complete(tmp_path):
    out = history.periods(gold(tmp_path), "week", "2026-01-02T00:00:00+00:00")
    assert out["latest_complete"] == "2025-12-22"
    assert [r["complete"] for r in out["rows"]] == [True, False]
    assert out["rows"][1] == {"period_start": "2025-12-29", "role_family": "all", "ads": 9,
                              "days_covered": 3, "days_in_period": 7, "complete": False}


def test_skill_trends_take_the_latest_complete_month_and_only_sufficient_volume(tmp_path):
    out = history.skill_trends(gold(tmp_path), "2026-01-02T00:00:00+00:00")
    assert out["month"] == "2025-12"
    assert [(r["skill"], r["share_yoy_pp"]) for r in out["rows"]] == [("dbt", 25.0), ("SQL", 0.0)]
    assert out["rows"][0]["ads_with_skill"] == 20 and out["rows"][0]["previous_year_total_ads"] == 40
