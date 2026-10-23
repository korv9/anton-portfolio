"""Philosophy track 1: agreement statistics, the two nulls, the Swedish stop rule's inputs, the ETHICS
reply parser and the export, which must refuse a payload without its null."""
import sys
from pathlib import Path

import duckdb
import numpy as np
import pandas as pd
import pytest

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "platform/publish/philosophy"))

import export_moral as ex  # noqa: E402
from ml.moral import ethics, mfrc, riksdag, stats  # noqa: E402


def test_kappa_f1_and_alpha_on_known_cases():
    assert stats.kappa([1, 0, 1, 0], [1, 0, 1, 0]) == 1
    assert stats.kappa([1, 1, 0, 0], [1, 0, 1, 0]) == 0
    assert stats.f1([1, 1, 0, 0], [1, 0, 1, 0]) == 0.5
    assert stats.f1([0, 0], [0, 0]) is None
    assert stats.alpha_binary([[1, 1], [0, 0], [1, 1, 1], [0, 0]]) == 1
    # Krippendorff's worked binary case: two coders disagree on 2 of 10 units.
    units = [[0, 0]] * 4 + [[1, 1]] * 4 + [[0, 1], [1, 0]]
    assert stats.alpha_binary(units) == pytest.approx(1 - 0.2 / (2 * 10 * 10 / (20 * 19)))


def test_label_shuffle_null_separates_agreement_from_chance():
    rng = np.random.default_rng(1)
    truth = rng.integers(0, 2, 200)
    perfect = stats.label_shuffle_null(truth, truth, rounds=199)
    assert perfect["p"] == pytest.approx(1 / 200) and perfect["kappa_p95"] < 0.2
    assert stats.label_shuffle_null(truth, rng.integers(0, 2, 200), rounds=199)["p"] > 0.05


def test_party_null_finds_a_real_party_difference_and_not_a_random_one():
    rng = np.random.default_rng(2)
    years = np.repeat([2001, 2002], 200)
    parties = np.tile(np.repeat(["A", "B"], 100), 2)
    random = stats.party_null(rng.random(400) < 0.3, years, parties, rounds=199)
    assert random["p"] > 0.05
    real = stats.party_null(np.where(parties == "A", rng.random(400) < 0.6, rng.random(400) < 0.1),
                            years, parties, rounds=199)
    assert real["p"] == pytest.approx(1 / 200) and real["spread"] > real["spread_p95"]
    low, high = real["cells"][(2001, "A")]
    assert low < high < 0.5  # A's observed share (about 0.6) lies above its shuffled band


def test_holm_is_monotone_and_capped():
    assert stats.holm([0.01, 0.04, 0.03]) == pytest.approx([0.03, 0.06, 0.06])
    assert stats.holm([0.9, 0.8]) == [1.0, 1.0]


def test_shares_carry_bootstrap_intervals_and_the_null():
    rng = np.random.default_rng(3)
    n = 800  # 100 passages per party and year, over the 50-passage cell minimum
    frame = pd.DataFrame({"passage_id": [str(i) for i in range(n)], "year": np.repeat([2001, 2002], n // 2),
                          "party": np.tile(["S", "M", None, "V"], n // 4)})
    cells, spread = riksdag.shares(frame, rng.random((n, len(riksdag.FOUNDATIONS))) < 0.2)
    assert {"ci_low", "ci_high", "null_low", "null_high"} <= set(cells.columns)
    party_cells = cells[cells.party.notna()]
    assert len(party_cells) == 6 * 2 * 3 and party_cells.null_low.notna().all()
    assert cells[cells.party.isna()].passages.eq(n // 2).all()
    assert spread.null_p.between(0, 1).all() and (spread.holm_p >= spread.null_p).all()


def test_passages_ignore_markup_so_every_era_gives_the_same_unit():
    sentence = "Det här är en mening med precis tio ord i sig. "
    html = "<p>" + sentence * 3 + "</p><p>" + sentence * 3 + "</p>"
    crlf = (sentence * 3 + "\r\n") * 2
    wrapped = (sentence * 6).replace(" ord i sig.", " ord i\nsig.").replace("precis", "pre-\ncis")
    units = [riksdag.passages(raw) for raw in (html, crlf, wrapped)]
    assert units[0] == units[1] == units[2]
    assert all(15 <= len(p.split()) <= 80 for p in units[0]) and "precis" in units[2][0]
    assert riksdag.passages("Kort. Bara fem ord här.") == []
    index, chosen = riksdag.passage("H01-1", html)
    assert chosen == units[0][index]


def test_ceiling_compares_annotator_pairs_on_shared_comments():
    rows = pd.DataFrame({"comment_id": [1, 1, 1, 2, 2, 2], "annotator": ["a", "b", "c"] * 2,
                         "care": [True, True, False, False, False, True]})
    # Pairs: a-b agree on both, a-c and b-c disagree on both; F1 over ordered pairs.
    assert mfrc.ceiling(rows, {1, 2}, "care") == pytest.approx(1 / 3)
    assert mfrc.ceiling(rows, {1, 2}, "care", predicted={1: True, 2: False}) == pytest.approx(2 / 3)


def test_gate_passes_fails_and_validates_per_foundation():
    english = pd.Series(0.5, index=riksdag.FOUNDATIONS)
    truth = pd.DataFrame({f: [True] * 20 + [False] * 80 for f in riksdag.FOUNDATIONS})
    perfect = truth.to_numpy()
    passed = riksdag.decide(truth, perfect, english)
    assert passed["passed"] and passed["status"] == "passed" and passed["raters"] == 1
    assert all(r["validated"] for r in passed["foundations"])
    failed = riksdag.decide(truth, ~perfect, english)
    assert not failed["passed"] and failed["status"] == "failed"
    assert not any(r["validated"] for r in failed["foundations"])
    # Under 10 positives a foundation is not validated even when the gate passes.
    few = truth.copy()
    few["purity"] = [True] * 5 + [False] * 95
    mixed = riksdag.decide(few, few.to_numpy(), english)
    assert mixed["passed"] and {r["foundation"]: r["validated"] for r in mixed["foundations"]}["purity"] is False


def test_gate_holds_at_exactly_the_ratio_and_fails_just_below():
    english = pd.Series(1.0, index=riksdag.FOUNDATIONS)
    truth = pd.DataFrame({f: [True] * 20 + [False] * 80 for f in riksdag.FOUNDATIONS})

    def predicted(false_positives: int) -> np.ndarray:
        # 14 of 20 found plus the false positives: F1 28/35 = 0.8 with one, 28/36 with two.
        row = [True] * 14 + [False] * 6 + [True] * false_positives + [False] * (80 - false_positives)
        return np.array([row] * len(riksdag.FOUNDATIONS)).T

    at = riksdag.decide(truth, predicted(1), english)
    assert at["passed"] and all(r["validated"] for r in at["foundations"])
    below = riksdag.decide(truth, predicted(2), english)
    assert not below["passed"] and not any(r["validated"] for r in below["foundations"])


@pytest.mark.parametrize("bad", [2, 0.5, -1, "x", None])
def test_gate_refuses_labels_other_than_zero_or_one(tmp_path, monkeypatch, bad):
    monkeypatch.setattr(riksdag, "RUN", tmp_path)
    pd.DataFrame({"passage_id": ["a", "b"], "text": ["t", "u"]}).to_parquet(tmp_path / "sample.parquet")
    labels = pd.DataFrame({"passage_id": ["a", "b"], **{f: [1, 0] for f in riksdag.FOUNDATIONS}})
    labels["care"] = labels["care"].astype(object)
    labels.loc[0, "care"] = bad
    labels.to_csv(tmp_path / "labels.csv", index=False)
    monkeypatch.setattr(riksdag, "embed", lambda *a: pytest.fail("embedded before the labels were checked"))
    with pytest.raises(SystemExit, match="0 or 1"):
        riksdag.gate(tmp_path / "labels.csv")


def test_bootstrap_moves_items_that_share_a_scenario_together():
    values = np.array([1, 1, 0, 0, 1, 0])
    alone = stats.bootstrap(values, np.mean, rounds=200)
    grouped = stats.bootstrap(values, np.mean, rounds=200, groups=["a", "a", "b", "b", "c", "c"])
    assert grouped[1] - grouped[0] >= alone[1] - alone[0]


def test_ceiling_gap_matches_the_two_ceilings():
    rows = pd.DataFrame({"comment_id": [1, 1, 1, 2, 2, 2], "annotator": ["a", "b", "c"] * 2,
                         "care": [True, True, False, False, False, True]})
    wide = rows.pivot(index="comment_id", columns="annotator", values="care").astype(float).to_numpy()
    gap = mfrc.ceiling_gap(wide, np.array([True, False]), np.ones(2))
    assert gap == pytest.approx(mfrc.ceiling(rows, {1, 2}, "care", predicted={1: True, 2: False})
                                - mfrc.ceiling(rows, {1, 2}, "care"))


def test_reply_parser_takes_the_first_word_only():
    assert ethics.parse("justice", "Yes.") == 1 and ethics.parse("virtue", "**No**") == 0
    assert ethics.parse("utilitarianism", "B") == "B"
    assert ethics.parse("commonsense", "It cannot be determined.") is None


def gold(con, with_null: bool = True) -> None:
    con.execute("create schema gold")
    con.execute("""create table gold.mart_moral_foundation_agreement as
        select f as foundation, f = 'fairness' as merged, 3647 as test_comments, 0.5 as tagger_f1,
               0.4 as human_pair_f1, 0.45 as tagger_vs_annotator_f1, 0.3 as human_alpha
        from unnest(['care','equality','proportionality','loyalty','authority','purity','fairness']) t(f)""")
    con.execute("""create table gold.mart_moral_swedish_check as select 'awaiting labels' as status,
        null::int as passages, null::int as raters, null::double as swedish_macro_f1, null::double as english_macro_f1,
        null::double as ratio_required, null::boolean as passed, null::varchar as foundation, null::int as positives,
        null::double as swedish_f1, null::double as english_f1, null::boolean as validated""")
    null = ", 0.12 as null_kappa_p95, 0.001 as null_p" if with_null else ""
    con.execute(f"""create table gold.mart_ethics_agreement as
        select s as subset, w as wording, 200 as items, 0 as unparsed, 0.8 as accuracy, 0.6 as kappa,
               0.55 as majority_accuracy, 999 as null_rounds, true as beats_null_both_wordings {null}
        from unnest(['commonsense','deontology','justice','utilitarianism','virtue']) a(s), unnest([1, 2]) b(w)""")


def test_export_publishes_no_riksdag_shares_before_the_swedish_check():
    con = duckdb.connect()
    gold(con)
    moral, result = ex.moral_payload(con), ex.ethics_payload(con)
    ex.check_nulls(moral, result)
    assert moral["status"] == "awaiting labels" and moral["riksdag"] is None
    assert moral["diagnostics"]["english_macro_f1"] == 0.5 and len(result["subsets"]) == 10
    assert moral["generated_at"] and result["method"]["null"]


def test_export_refuses_a_payload_without_its_null():
    con = duckdb.connect()
    gold(con, with_null=False)
    with pytest.raises(ValueError, match="label-shuffle null"):
        ex.check_nulls(ex.moral_payload(con), ex.ethics_payload(con))
    passed = {"riksdag": {"shares": [{}], "spread": []}}
    with pytest.raises(ValueError, match="party shuffle null"):
        ex.check_nulls(passed, {"subsets": []})
