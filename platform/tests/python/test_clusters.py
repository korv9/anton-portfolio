"""Clustering batches 0-2: each statistic behind a `diagnostics` block, on data with a known
answer. Every test fails if its null or bootstrap is replaced by a constant or removed."""
import sys
from pathlib import Path

import numpy as np
import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "publish/clusters"))

import debate_topics  # noqa: E402
import demand_curves  # noqa: E402
import eras  # noqa: E402
import labour_market  # noqa: E402
import stats  # noqa: E402
import talk_vote  # noqa: E402
import tax_mix  # noqa: E402
import trajectories  # noqa: E402

RNG = np.random.default_rng(7)


def blobs(n=30, k=3, spread=0.2, dims=4):
    centres = np.eye(k, dims) * 5
    return np.vstack([c + RNG.normal(0, spread, (n, dims)) for c in centres]), np.repeat(np.arange(k), n)


def test_bootstrap_ari_refits_on_resampled_rows():
    x, truth = blobs()
    stable = stats.bootstrap_ari(x, truth, stats.kmeans(3), rounds=20)
    noise = stats.bootstrap_ari(x, truth, lambda d: np.random.default_rng(len(d)).integers(0, 3, len(d)), rounds=20)
    assert stable["rounds"] == 20 and stable["mean"] > 0.95 and stable["p05"] <= stable["mean"] <= stable["p95"]
    assert noise["mean"] < 0.2


def test_permutation_null_separates_structure_from_noise():
    x, _ = blobs()
    fit = stats.kmeans(3)
    structured = stats.permutation_null(x, stats.silhouette(x, fit(x)), fit, rounds=30)
    flat = RNG.normal(size=(90, 4))
    unstructured = stats.permutation_null(flat, stats.silhouette(flat, fit(flat)), fit, rounds=30)
    assert structured["p"] <= round(1 / 31, 4) and structured["null_95"] < structured["observed"]
    assert unstructured["p"] > 0.05


def test_diagnostics_marks_unstable_clusters_as_counter_examples():
    labels = np.array([0, 0, 1, 1, -1])
    assert stats.diagnostics(labels, 0.5, {"mean": 0.59}, None)["status"] == "counter_example"
    assert stats.diagnostics(labels, 0.5, {"mean": 0.6}, None)["status"] == "finding"
    assert stats.diagnostics(labels, None, None, None)["status"] == "unvalidated"
    assert stats.diagnostics(labels, 0.5, None, None)["noise_share"] == 0.2


def test_debate_share_intervals_come_from_resampled_speeches():
    counts = np.array([[5, 0], [0, 5], [5, 0], [0, 5]], float)
    share, low, high = debate_topics.bootstrap_shares(counts, rounds=200)
    assert share.tolist() == [0.5, 0.5]
    assert (low < share).all() and (high > share).all()
    single, low1, high1 = debate_topics.bootstrap_shares(np.array([[3, 1]], float))
    assert (low1 == single).all() and (high1 == single).all()


def test_debate_year_association_null_shuffles_whole_debates():
    debate = np.repeat(np.arange(20), 10)
    year = debate // 2
    tied = debate_topics.association_null(year % 3, year, debate, rounds=99)
    loose = debate_topics.association_null(RNG.integers(0, 3, 200), year, debate, rounds=99)
    assert tied["p"] <= 0.02 and loose["p"] > 0.05


def test_mantel_permutation_null():
    points = RNG.normal(size=(8, 2))
    a = np.linalg.norm(points[:, None] - points[None], axis=2)
    r, null = talk_vote.mantel(a, a * 2, rounds=199)
    assert r == pytest.approx(1) and (null < r - 1e-9).mean() > 0.9
    other = np.linalg.norm(RNG.normal(size=(8, 2))[:, None] - RNG.normal(size=(8, 2))[None], axis=2)
    other = (other + other.T) / 2
    np.fill_diagonal(other, 0)
    _, null2 = talk_vote.mantel(a, other, rounds=199)
    assert null2.std() > 0.05


def test_talk_tree_bootstrap_resamples_topics():
    shares = np.vstack([np.r_[np.full(10, 0.09), np.full(10, 0.01)]] * 3 + [np.r_[np.full(10, 0.01), np.full(10, 0.09)]] * 3
                       + [np.full(20, 0.05)] * 2)
    labels = talk_vote.fcluster(talk_vote.tree(talk_vote.hellinger(shares)), 3, "maxclust")
    boot = talk_vote.topic_bootstrap(shares, labels, rounds=20)
    assert len(boot) == 20 and np.mean(boot) > 0.9


def test_era_order_null_detects_time_structure():
    x = np.vstack([RNG.normal(m, 0.05, (8, 3)) for m in (0, 1, 2)])
    assert eras.order_null(x, 3, rounds=99)["p"] <= 0.02
    assert eras.order_null(x[RNG.permutation(len(x))], 3, rounds=99)["p"] > 0.05


def test_era_cut_picks_the_largest_jump():
    x = np.vstack([RNG.normal(m, 0.02, (6, 2)) for m in (0, 3, 6, 9)])
    assert eras.choose_cut(x)[0] == 4


def test_tax_branch_support_from_country_bootstrap():
    x, truth = blobs(n=8, spread=0.1)
    support = tax_mix.clade_support(x, rounds=50)
    groups = {frozenset(np.flatnonzero(truth == g)) for g in range(3)}
    assert all(s == 1.0 for c, s in support if c in groups)
    assert all(s is None or 0 <= s <= 1 for _, s in support)
    assert any(s < 1 for c, s in support if c not in groups)


def test_trajectory_null_shuffles_years_within_municipality():
    flat = np.arange(2 * 15 * 3, dtype=float).reshape(2, -1)
    drawn = trajectories.shuffle_years(flat, np.random.default_rng(0))
    assert sorted(drawn[0]) == sorted(flat[0]) and not np.array_equal(drawn, flat)
    t = np.linspace(0, 1, 15)
    shapes = np.vstack([np.c_[s, s, s].ravel() + RNG.normal(0, 0.05, 45) for s in (t, 1 - t, np.sin(6 * t)) for _ in range(10)])
    fit = stats.kmeans(3)
    null = stats.permutation_null(shapes, stats.silhouette(shapes, fit(shapes)), fit, rounds=30,
                                  shuffle=trajectories.shuffle_years)
    assert null["p"] <= round(1 / 31, 4)


def test_dtw_aligns_shifted_series():
    base = np.sin(np.linspace(0, 6, 15))[None, :, None]
    shifted = np.roll(base, 2, axis=1)
    d = trajectories.dtw(np.concatenate([base, shifted]))
    assert d[0, 1] == d[1, 0] < np.linalg.norm(base - shifted) and d[0, 0] == 0


def test_seasonal_null_and_block_bootstrap():
    months = np.arange(45)
    season = np.sin(2 * np.pi * months / 12)
    y = np.vstack([season * a + 0.02 * months + RNG.normal(0, 0.05, 45) for a in (1, 1, 1, -1, -1, -1)])
    trend, profile, _ = demand_curves.decompose(y, 0)
    assert trend.shape == (6, 33) and np.corrcoef(profile[0], season[:12])[0, 1] > 0.95
    shifted = demand_curves.shift_season(profile, np.random.default_rng(1))
    assert np.allclose(np.sort(shifted, axis=1), np.sort(profile, axis=1))
    labels = np.array([0, 0, 0, 1, 1, 1])
    boot = demand_curves.block_bootstrap(y, 0, "seasonal profile", labels, demand_curves.correlation_fit(2), rounds=10)
    assert boot["rounds"] == 10 and boot["mean"] > 0.9


def test_gap_statistic_finds_three_groups():
    x, _ = blobs(n=20, spread=0.3)
    assert labour_market.gap_k(x, range(2, 6), references=5) == 3
    assert np.allclose(labour_market.clr(np.array([[1.0, 4.0, 9.0]])).sum(), 0)
