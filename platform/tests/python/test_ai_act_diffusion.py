"""AI Act diffusion clock: the log-odds score, the term pattern, the monthly counts, the adoption
rule and the placebo null, and the export read from a small gold fixture."""
import re
import sys
from pathlib import Path

import duckdb
import pandas as pd

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "platform/nlp"))
sys.path.insert(0, str(ROOT / "platform/publish/cross_domain"))
sys.path.insert(0, str(ROOT))

import ai_act_terms as at  # noqa: E402
import export_ai_act_diffusion as ex  # noqa: E402
from ml.ai_act import diffusion as df  # noqa: E402


def test_log_odds_favours_act_only_terms_and_is_near_zero_at_equal_rates():
    assert at.log_odds_z(50, 10_000, 0, 1_000_000) > 5
    assert abs(at.log_odds_z(10, 10_000, 1_000, 1_000_000)) < 0.5
    assert at.log_odds_z(1, 10_000, 10_000, 1_000_000) < 0


def test_candidates_need_count_articles_and_no_stopword_edges():
    act = {f"art_{i}": "ai-byrån ska granska. ai-byrån och kommissionen." for i in range(6)}
    per, totals = at.article_counts(act, 4, at.STOP_SV)
    assert ("ai-byrån",) in per and ("och", "kommissionen") not in per
    rows = at.score(per, totals, ["kommissionen ska granska lagen."] * 50)
    assert rows[0]["term_sv"] == "ai-byrån" and rows[0]["sfs_count"] == 0
    assert "kommissionen" not in {r["term_sv"] for r in rows}  # common in the reference


def test_pattern_takes_inflection_space_or_hyphen_but_not_a_longer_word():
    p = re.compile(df.pattern("ai-system med hög risk"), re.I)
    assert p.search("Alla AI-system med hög risken") and p.search("ai-system med hög-risk")
    assert not p.search("ai-system med hög riskbedömning")
    assert not p.search("xai-system med hög risk")


def test_counts_skip_future_dates_and_count_each_document_once_per_term():
    counts = df.Counts([("t:sv", re.compile(df.pattern("ai-byrån"), re.I))])
    counts.add("2025-03-02", "AI-byrån, AI-byrån")
    counts.add("2025-03-30", "inget")
    counts.add("2099-01-01", "AI-byrån")
    assert counts.months == {"2025-03": 2} and counts.hits == {("2025-03", "t:sv"): 1}
    assert counts.dates == ["2025-03-02", "2025-03-30"]


def test_adoption_is_the_first_month_above_the_earlier_95th_percentile():
    values = [0.0] * 20 + [0.0, 0.0, 0.02, 0.03]
    assert ex.adoption_lag(values, 20) == (0.0, 2)
    assert ex.adoption_lag([0.0] * 30, 20)[1] is None


STEP = [0.0] * 84 + [0.01] * 36   # the term appears from month 84 and stays
TREND = [i / 1000 for i in range(120)]  # rises every month whatever the date


def test_placebo_separates_a_step_at_the_milestone_from_a_steady_trend():
    step_p, eligible = ex.placebo_p(STEP, ex.adoption_lag(STEP, 84)[1], "step")
    trend_p, _ = ex.placebo_p(TREND, ex.adoption_lag(TREND, 84)[1], "trend")
    assert eligible == 108 and step_p < 0.1
    assert trend_p == 1.0  # every random month shows lag 0 too
    assert ex.placebo_p(STEP, None, "censored") == (None, 0)
    assert ex.placebo_p(STEP, 0, "step") == ex.placebo_p(STEP, 0, "step")  # seeded


def test_year_labels_mark_partial_years_with_their_months():
    labels = ex.year_labels(["2025-12"] + [f"2026-{m:02d}" for m in range(1, 10)])
    assert labels == [{"year": 2025, "months": 1, "label": "2025 (Dec-Dec)"},
                      {"year": 2026, "months": 9, "label": "2026 (Jan-Sep)"}]


def gold_fixture() -> duckdb.DuckDBPyConnection:
    con = duckdb.connect()
    for schema in ("seeds", "gold"):
        con.execute(f"create schema {schema}")
    terms = pd.DataFrame([
        {"term_id": "ai_byran", "term_sv": "ai-byrån", "term_en": "ai office", "act_count": 120, "sfs_count": 0,
         "z": 12.3, "decision": "keep", "reason": None, "en_decision": "keep"},
        {"term_id": "hog", "term_sv": "hög", "term_en": "high", "act_count": 300, "sfs_count": 400,
         "z": 14.0, "decision": "drop", "reason": "general_language", "en_decision": None}])
    con.register("terms_df", terms)
    con.execute("create table seeds.ai_act_terms as select * from terms_df")
    con.execute("""create table gold.mart_ai_act_timeline as
        select * from (values ('m1', date '2023-01-12', 'One', 'Ett'), ('m2', date '2031-01-01', 'Late', 'Sent'))
        t(milestone_id, date, title_en, title_sv)""")
    months = pd.date_range("2016-01-01", periods=120, freq="MS")
    rows = [{"corpus": "riksdag", "term_id": "ai_byran", "language": lang, "term": "x", "month": m.date(),
             "matches": int(v * 1000), "documents": 1000, "share_rolling_3m": v}
            for lang in ("sv", "en") for m, v in zip(months, STEP)]
    con.register("mart_df", pd.DataFrame(rows))
    con.execute("create table gold.mart_ai_act_term_diffusion as select * from mart_df")
    return con


def test_export_gives_every_uncensored_lag_a_placebo_p_from_200_dates():
    payload = ex.build(gold_fixture())
    lags = payload["lags"]
    assert {x["milestone_id"] for x in lags} == {"m1"}  # the milestone after the data is not tested
    assert all(x["lag_months"] == 0 and x["placebo_p"] is not None and x["placebo_p"] < 0.1 for x in lags)
    assert payload["diagnostics"]["placebo_rounds"] == 200 and payload["diagnostics"]["with_p"] == 2
    assert payload["dropped"] == [{"term_sv": "hög", "reason": "general_language"}]
    assert payload["corpora"][0]["swedish_share"][0]["rows"][0] == ["2023-01", 10, 10]  # months with a match only
    assert {"method", "diagnostics", "generated_at"} <= payload.keys()
