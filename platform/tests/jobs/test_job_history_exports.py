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
    """A COUNTS row; by default no employer writes more than a tenth of a window's uses."""
    return ("term", word, n or len(word.split()), recent, before, employers, own_name,
            recent // 10, before // 10)


TOTALS = [("total", side, n, grams, 0, 0, 0, 0, 0)
          for side in ("recent", "before") for n, grams in ((1, 100_000), (2, 90_000))]


def test_rank_drops_function_words_in_both_languages_and_at_either_end_of_a_phrase():
    words = ["vi", "blir", "kommer", "you", "we", "will", "ll", "you ll", "beslut om", "för dbt"]
    ranked = rt.rank(TOTALS + [term(w, 500, 10) for w in words] + [term("dbt", 500, 10)], set())
    assert [r["term"] for r in ranked["rising"]] == ["dbt"]
    assert ranked["dropped"]["stopword_or_number"] == len(words)


def test_rank_drops_ad_and_application_words():
    found = TOTALS + [term(w, 500, 10) for w in ("annons", "ansökan", "apply", "position", "sista ansökningsdag")]
    ranked = rt.rank(found + [term("lakehouse", 500, 10)], set())
    assert [r["term"] for r in ranked["rising"]] == ["lakehouse"] and ranked["dropped"]["boilerplate"] == 5


def test_rank_drops_a_term_one_employer_wrote_more_than_a_third_of_in_either_window():
    brand = ("term", "cars", 1, 10, 300, 28, 0, 3, 101)       # 101 of 300 earlier uses: one employer
    even = ("term", "kotlin", 1, 10, 300, 28, 0, 3, 100)      # exactly a third: kept
    small = ("term", "rust", 1, 300, 9, 28, 0, 30, 9)         # 9 uses in a window is too few to judge
    ranked = rt.rank(TOTALS + [brand, even, small], set())
    assert ranked["dropped"]["one_employer"] == 1
    assert {r["term"] for r in ranked["falling"]} == {"kotlin"} and {r["term"] for r in ranked["rising"]} == {"rust"}


def test_counts_match_employer_names_by_word_start_and_give_the_largest_employer_per_window(tmp_path):
    con = duckdb.connect(str(tmp_path / "terms.duckdb"))
    con.execute("create schema gold")
    con.execute("create schema bronze")
    ads = [(f"a{i}", employer, f"{year}-03-01", text) for i, (employer, year, text) in enumerate(
        [("Volvo Car Corporation", 2025, "volvo cars bygger cars")] * 3
        + [("Firma Data AB", 2024, "cars och careers")] * 2)]
    con.execute("create table gold.fct_job_ads (job_id varchar, role_family varchar, published_at timestamp)")
    con.execute("create table bronze.stg_job_ads (job_id varchar, employer_name varchar, description varchar)")
    con.executemany("insert into gold.fct_job_ads values (?, 'Data Engineer', ?)", [(a, d) for a, _, d, _ in ads])
    con.executemany("insert into bronze.stg_job_ads values (?, ?, ?)", [(a, e, t) for a, e, _, t in ads])
    rows = con.execute(rt.COUNTS, {
        "role": "Data Engineer", "before": date(2024, 1, 1), "recent": date(2025, 1, 1), "end": date(2026, 1, 1),
        "token": rt.TOKEN.pattern, "stop": sorted(rt.STOP), "min_uses": 1, "min_employers": 1}).fetchall()
    found = {r[1]: r for r in rows if r[0] == "term"}
    # term, uses recent/before, employers, uses in the employer's own name, top employer per window
    assert found["cars"][3:] == (6, 2, 2, 6, 6, 2)      # cars ~ car (Volvo Car), not data
    assert found["volvo cars"][3:] == (3, 0, 1, 3, 3, 0)
    assert found["careers"][3:] == (0, 2, 1, 0, 0, 2)   # careers is not car: three letters apart
    assert "och" not in found


def test_rank_drops_stopwords_numbers_employer_and_place_names_and_caps_each_side():
    totals = TOTALS
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
    assert ranked["dropped"] == {"stopword_or_number": 2, "boilerplate": 0, "one_employer": 0,
                                 "employer_name": 1, "place_name": 3}
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


def test_employer_top_keeps_names_and_counts_and_refuses_identity_numbers(tmp_path):
    import export_employer_top as top
    con = duckdb.connect(str(tmp_path / "top.duckdb"))
    con.execute("create schema gold")
    con.execute("""create table gold.mart_job_employer_top as select * from (values
        ('year', date '2025-01-01', date '2026-01-01', true, 1, 'Firma A AB', 40),
        ('year', date '2025-01-01', date '2026-01-01', true, 2, 'Firma B AB', 30)) as t(
        period_kind, period_start, period_end, complete, employer_rank, employer_name, ads)""")
    data = top.build(con)
    assert data["rows"] == [{"period_kind": "year", "from": "2025-01-01", "until": "2026-01-01", "complete": True,
                             "employers": [{"rank": 1, "employer": "Firma A AB", "ads": 40},
                                           {"rank": 2, "employer": "Firma B AB", "ads": 30}]}]
    assert top.problems(data) == []
    for number in ("556677-8899", "8501151234", "19850115-1234"):
        data["rows"][0]["employers"][1]["employer"] = f"Bo {number}"
        assert top.problems(data) == ["an identity or organisation number is present"]
    data["rows"][0]["employers"] = [{"rank": 1, "employer": "X", "ads": 1}] * 21
    assert top.problems(data) == ["year: more than 20 employers"]


def test_employer_top_shows_a_year_that_equals_the_latest_twelve_months_once(tmp_path):
    import export_employer_top as top
    con = duckdb.connect(str(tmp_path / "top.duckdb"))
    con.execute("create schema gold")
    con.execute("""create table gold.mart_job_employer_top as select * from (values
        ('year', date '2025-01-01', date '2026-01-01', true, 1, 'Firma A AB', 40),
        ('latest_12_months', date '2025-01-01', date '2026-01-01', true, 1, 'Firma A AB', 40)) as t(
        period_kind, period_start, period_end, complete, employer_rank, employer_name, ads)""")
    assert [p["period_kind"] for p in top.build(con)["rows"]] == ["latest_12_months"]
    con.execute("update gold.mart_job_employer_top set period_start = date '2025-03-01' "
                "where period_kind = 'latest_12_months'")
    assert [p["period_kind"] for p in top.build(con)["rows"]] == ["latest_12_months", "year"]
