"""Feature builders of ml/feature_study on data with a known answer."""
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
    flags = np.array([[1, 1, 0, 0]] * 20 + [[0, 0, 1, 1]] * 20 + [[0, 0, 0, 0]], float)
    v = job_ads.stack_vectors(flags, dims=2)
    assert np.allclose(v[-1], 0)
    assert np.linalg.norm(v[0] - v[1]) < np.linalg.norm(v[0] - v[20])


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
