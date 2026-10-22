"""Clustering batches 0-2: each statistic behind a `diagnostics` block, on data with a known
answer. Every test fails if its null or bootstrap is replaced by a constant or removed."""
import contextlib
import sys
from pathlib import Path

import numpy as np
import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "publish/clusters"))

import debate_topics  # noqa: E402
import demand_curves  # noqa: E402
import eras  # noqa: E402
import export  # noqa: E402
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
    large = np.repeat([0, 1], 25)
    assert stats.diagnostics(labels, 0.5, {"mean": 0.59}, None)["status"] == "counter_example"
    assert stats.diagnostics(labels, 0.5, {"mean": 0.6}, None)["status"] == "descriptive"
    assert stats.diagnostics(large, 0.5, {"mean": 0.6}, None)["status"] == "finding"
    assert stats.diagnostics(large, 0.5, {"mean": 0.9}, None, period_ari={"periods": [1, 2], "ari": 0.32})["status"] == "counter_example"
    assert "seed_ari" in stats.diagnostics(large, 0.5, {"mean": 0.9}, None, stability_key="seed_ari")
    assert stats.diagnostics(labels, None, None, None)["status"] == "unvalidated"
    assert stats.diagnostics(labels, 0.5, None, None)["noise_share"] == 0.2


def test_k_flags_mark_sweep_ends_and_near_ties():
    assert stats.k_flags({2: 0.5, 3: 0.4, 4: 0.3}, 2)[0].startswith("k = 2 is at the end")
    assert stats.k_flags({2: 0.3, 3: 0.402, 4: 0.4}, 3) == ["k = 4 is within 0.005 of k = 3 (0.4 vs 0.402)"]
    assert stats.k_flags({2: 0.3, 3: 0.5, 4: 0.4}, 3) == []


def test_save_writes_features_and_registers_a_stable_run(tmp_path, monkeypatch):
    monkeypatch.setattr(stats, "FEATURES", tmp_path / "features")
    monkeypatch.setattr(stats, "LAB", tmp_path / "lab")
    inputs = stats.pd.DataFrame({"x": [1.0, 2.0]})
    rows = stats.frame("demo", ["a", "b"], ["A", "B"], "2024", [0, 1])
    metrics = {"diagnostics": {"status": "finding", "k": np.int64(2)}}
    first = stats.save("demo", inputs, rows, metrics)
    assert stats.save("demo", inputs, rows, metrics) == first
    saved = stats.json.loads((tmp_path / "features/demo/run/metrics.json").read_text(encoding="utf-8"))
    assert saved["run_id"] == first and saved["diagnostics"]["k"] == 2
    assert stats.save("demo", inputs, rows, {**metrics, "method": {"k": 3}}) != first
    registry = stats.Registry(stats.LAB)
    assert registry.get(first)["status"] == "completed"
    registry.close()
    with pytest.raises(ValueError):
        stats.save("demo", inputs, rows, {"diagnostics": {"ari": float("nan")}})


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
    flat = RNG.dirichlet(np.ones(20) * 50, 8)
    loose = talk_vote.topic_bootstrap(flat, talk_vote.fcluster(talk_vote.tree(talk_vote.hellinger(flat)), 3, "maxclust"),
                                      rounds=20)
    assert np.mean(loose) < 0.9 and np.std(loose) > 0


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
    levels = np.repeat(np.array([0.0, 2.0, 4.0]), 10)[:, None] + RNG.normal(0, 0.3, (30, 45))
    kept = stats.permutation_null(levels, stats.silhouette(levels, fit(levels)), fit, rounds=30,
                                  shuffle=trajectories.shuffle_years)
    assert kept["p"] > 0.05  # shuffling years keeps levels, so level groups do not beat this null


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
    noise = RNG.normal(0, 1, (6, 45))
    loose = demand_curves.block_bootstrap(noise, 0, "seasonal profile", labels, demand_curves.correlation_fit(2), rounds=10)
    assert loose["mean"] < 0.5 and loose["p05"] < loose["p95"]


def test_gap_statistic_finds_the_number_of_groups():
    x, _ = blobs(n=20, spread=0.3)
    assert labour_market.gap_k(x, range(2, 6), references=5) == 3
    x4, _ = blobs(n=20, k=4, spread=0.3)
    assert labour_market.gap_k(x4, range(2, 7), references=5) == 4
    assert np.allclose(stats.clr(np.array([[1.0, 4.0, 9.0]])).sum(), 0)


def test_labour_market_matrix_drops_small_municipalities_and_aligns_fields():
    rows = stats.pd.DataFrame({"year": [2023, 2023, 2023], "municipality_code": ["a", "a", "b"],
                               "occupation_field": ["x", "y", "x"], "ads": [200, 150, 299]})
    wide, dropped = labour_market.matrix(rows, [2023], 300, columns=["x", "y", "z"])
    assert wide.index.tolist() == ["a"] and dropped == 1 and wide.columns.tolist() == ["x", "y", "z"]
    assert wide.loc["a", "z"] == 0


def test_tax_mix_splits_income_and_goods_into_nine_parts():
    wide = stats.pd.DataFrame([{"_T": 100, "T_1000": 40, "T_1100": 25, "T_1200": 10, "T_2000": 20, "T_3000": 0,
                                "T_4000": 5, "T_5000": 30, "T_5111": 20, "T_6000": 5}])
    shares = tax_mix.mix(wide).iloc[0]
    assert len(shares) == 9 and shares.sum() == pytest.approx(1)
    assert shares.other_income > shares.payroll > 0  # 5 % of tax against the 0.1 % floor
    assert shares.other_goods_services / shares.vat == pytest.approx(0.5)


def test_export_writes_nothing_when_one_file_is_too_large(tmp_path, monkeypatch):
    monkeypatch.setattr(export, "OUT", tmp_path)
    monkeypatch.setattr(export, "payload", lambda con, name: {"name": name, "pad": "x" * (10 if name == "a" else 300)})
    monkeypatch.setattr(export, "MAX_BYTES", 100)
    monkeypatch.setattr(export.duckdb, "connect", lambda *a, **k: contextlib.nullcontext())
    with pytest.raises(SystemExit):
        export.main(["a", "b"])
    assert not list(tmp_path.iterdir())
    monkeypatch.setattr(export, "payload", lambda con, name: {"value": float("nan")})
    with pytest.raises(ValueError):
        export.main(["a"])
