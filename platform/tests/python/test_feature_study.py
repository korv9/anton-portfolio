"""Feature builders of ml/feature_study on data with a known answer."""
import json
import re
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))

from ml.feature_study import futures, job_ads, municipal, report, talk_vote  # noqa: E402


def panel():
    years = np.arange(2014, 2025)
    rows = []
    for code, trend in (("0114", 0.5), ("0115", -1.0)):
        for y in years:
            rows.append({"municipality_code": code, "year": y, "population": 10000,
                         "library_visits": 20000, "median_earned_income_sek": 300000,
                         "open_unemployment_18_65_pct": 5 + trend * (y - 2014)})
    return pd.DataFrame(rows)


def test_change_and_slope_recover_a_linear_trend():
    p = panel()
    change = municipal.change(p, ["open_unemployment_18_65_pct"], 2024, 2015)
    slope = municipal.slope(p, ["open_unemployment_18_65_pct"], 2015, 2024)
    assert change.loc["0114", "change_open_unemployment_18_65_pct"] == 4.5
    assert np.isclose(slope.loc["0115", "slope_open_unemployment_18_65_pct"], -1.0)
    short = municipal.slope(p, ["open_unemployment_18_65_pct"], 2022, 2024)
    assert short.isna().all().all()  # three years are fewer than min_years


def test_per_capita_and_party_clr():
    p = panel().head(1).copy()
    out = municipal.per_capita(p)
    assert np.isclose(out.library_visits.iloc[0], np.log(2001))
    for share, value in zip(municipal.SHARES, (30, 20, 20, 10, 5, 5, 4, 4)):
        p[share] = value
    clr = municipal.party_clr(p)
    assert clr.shape[1] == 9 and np.isclose(clr.to_numpy().sum(), 0)
    assert clr.clr_s.iloc[0] > clr.clr_l.iloc[0]


def test_job_fields_drop_small_municipalities_and_sum_to_zero():
    rows = pd.DataFrame({"municipality_code": ["a", "a", "b", "b"], "occupation_field": ["x", "y", "x", "y"],
                         "ads": [600, 400, 10, 5]})
    out = municipal.job_fields(rows)
    assert list(out.index) == ["a"] and np.isclose(out.to_numpy().sum(), 0)


def test_cluster_report_scores_structure_above_noise():
    rng = np.random.default_rng(1)
    blobs = np.vstack([c + rng.normal(0, 0.2, (25, 3)) for c in np.eye(3) * 5])
    good = report.cluster_report(blobs, fixed_k=3, rounds=10, null_rounds=10)
    noise = report.cluster_report(rng.normal(size=(75, 3)), fixed_k=3, rounds=10, null_rounds=10)
    assert good["fixed"]["bootstrap_ari"]["mean"] > 0.9 and good["fixed"]["null_margin"] > 0.3
    assert noise["fixed"]["null_margin"] < good["fixed"]["null_margin"]


def test_stack_vectors_put_co_mentioned_skills_together():
    flags = np.array([[1, 1, 0, 0]] * 20 + [[0, 0, 1, 1]] * 20 + [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0],
                                                                  [0, 0, 0, 0]], float)
    v = job_ads.stack_vectors(flags, dims=2)
    assert np.allclose(v[-1], 0)
    # an ad with skill 0 sits nearer one with skill 1 (co-mentioned) than one with skill 2
    assert np.linalg.norm(v[40] - v[41]) < np.linalg.norm(v[40] - v[42])
    assert np.linalg.norm(v[0] - v[40]) < np.linalg.norm(v[0] - v[20])


def test_seniority_signals():
    years = re.compile(job_ads.SIGNALS["years"])
    assert years.search("minst 5 års erfarenhet av java").group(1) == "5"
    assert years.search("3+ years of professional experience").group(1) == "3"
    assert not years.search("grundat 2015 års verksamhet")
    assert re.search(job_ads.SIGNALS["remote"], "möjlighet att arbeta på distans")


def test_futures_marker_and_residuals():
    assert futures.marker("Vi måste tänka långsiktigt om vår framtid") == "long_term"
    assert futures.marker("Fram till 2030 ska utsläppen halveras") == "horizon"
    assert futures.marker("Inget här") == "other"
    rng = np.random.default_rng(0)
    x = np.column_stack([np.ones(200), rng.integers(0, 2, 200)])
    vectors = x @ rng.normal(size=(2, 5)) + rng.normal(0, 0.01, (200, 5))
    out = futures.residualise(vectors, x)
    assert abs(np.corrcoef(out[:, 0], x[:, 1])[0, 1]) < 0.2


def test_talk_distances_cut_two_blocs():
    words = np.array([[90, 10, 1], [85, 15, 2], [80, 20, 1], [5, 10, 90], [8, 12, 85], [2, 90, 10]], float)
    vote = 1 - np.eye(6)
    d = talk_vote.distances(words, words, vote)
    assert set(d) == {"hellinger", "aitchison", "pooled", "votes", "talk+votes"}
    labels = talk_vote.cut(d["hellinger"])
    assert labels[0] == labels[1] == labels[2] != labels[3]
    assert np.allclose(d["aitchison"], d["aitchison"].T) and np.allclose(np.diag(d["aitchison"]), 0)


def ads(n=200, seed=0):
    rng = np.random.default_rng(seed)
    years = rng.integers(0, 8, n).astype(float)
    data = {"flags": rng.integers(0, 2, (n, 12)).astype(float), "words": rng.integers(100, 900, n).astype(float),
            "years": years, "lead": (years > 4).astype(float), "entry": (years == 0).astype(float),
            "remote": rng.integers(0, 2, n).astype(float), "title_senior_in_body": (years > 5).astype(float),
            "title_junior_in_body": (years < 1).astype(float)}
    return data, (years > 3).astype(int), np.repeat(np.arange(n // 4), 4).astype(str)


def test_job_feature_sets_add_each_block_to_the_skills():
    data, _, _ = ads()
    sets = job_ads.feature_sets(data)
    assert set(sets) == {"skills", "skills+size", "skills+stack", "skills+experience", "skills+all",
                         "skills+all+consistency"}
    assert sets["skills+size"].shape[1] == 12 + 2 and sets["skills+experience"].shape[1] == 12 + 5
    assert sets["skills+all"].shape[1] == 12 + 2 + 8 + 5
    assert np.array_equal(sets["skills+all"][:, :12], data["flags"])


def test_job_compare_scores_each_set_against_skills(monkeypatch):
    monkeypatch.setattr(job_ads, "BOOT", 50)
    data, y, groups = ads()
    sets = {k: v for k, v in job_ads.feature_sets(data).items() if k in ("skills", "skills+experience")}
    out = job_ads.compare(sets, y, groups, job_ads.auc, True, False)
    assert "vs_skills" not in out["skills"]
    gain = out["skills+experience"]["vs_skills"]
    assert gain["low"] > 0.2 and out["skills+experience"]["score"]["point"] > 0.9


def test_municipal_feature_sets_and_common_units():
    p = panel()
    for share, value in zip(municipal.SHARES, (30, 20, 20, 10, 5, 5, 4, 4)):
        p[share] = value
    p.loc[(p.municipality_code == "0115") & (p.year == 2015), "median_earned_income_sek"] = np.nan
    columns = ["open_unemployment_18_65_pct", "median_earned_income_sek"]
    sets = municipal.feature_sets(p, 2024, 2015, columns)
    assert set(sets) == {"levels", "engineered", "engineered+change", "engineered+slope"}
    assert sets["engineered"].shape[1] == 2 + 9
    assert list(municipal.common(sets)) == ["0114"]  # 0115 lacks its 2015 income, so no change


def test_talk_sessions_keep_their_position_and_lag_pairs_skip_gaps(tmp_path, monkeypatch):
    parties, sessions = ["A", "B", "C", "D"], ["2001/02", "2002/03", "2003/04"]
    topics = [{"model_id": talk_vote.published.MODEL, "topic_id": t, "session": s, "party": p, "words": 10 + t}
              for s in sessions for p in parties for t in range(3)]
    pairs = [{"session": s, "party_a": a, "party_b": b, "agreement_pct": 80.0}
             for s in sessions if s != "2002/03" for i, a in enumerate(parties) for b in parties[i + 1:]]
    (tmp_path / "t.json").write_text(json.dumps(topics), encoding="utf-8")
    (tmp_path / "v.json").write_text(json.dumps({"party_pairs": pairs}), encoding="utf-8")
    monkeypatch.setattr(talk_vote.published, "TOPICS", tmp_path / "t.json")
    monkeypatch.setattr(talk_vote.published, "VOTES", tmp_path / "v.json")
    rows = talk_vote.sessions()
    assert [r["position"] for r in rows] == [0, 2]  # 2002/03 has no votes
    assert rows[0]["pooled"].sum() == 2 * rows[0]["words"].sum()  # 2001/02 pools with 2002/03 only
    assert talk_vote.lag_pairs([0, 2], 1) == [] and talk_vote.lag_pairs([0, 2], 2) == [(0, 1)]
    assert talk_vote.lag_pairs([0, 1, 3, 4], 1) == [(0, 1), (2, 3)]


def test_pair_interval_resamples_sessions_not_pairs():
    # Session 0 is in five of the seven pairs; whenever it is not drawn only the zero pairs remain.
    pairs = [(0, i) for i in range(1, 6)] + [(6, 7), (8, 9)]
    out = talk_vote.pair_interval([1] * 5 + [0, 0], pairs, 10, np.random.default_rng(0))
    assert np.isclose(out["mean"], 5 / 7, atol=1e-4) and out["low"] == 0 and out["pairs"] == 7 and out["sessions"] == 10
    same = talk_vote.pair_interval([0.3, 0.3], [(0, 1), (1, 2)], 3, np.random.default_rng(0))
    assert same["low"] == same["high"] == 0.3
