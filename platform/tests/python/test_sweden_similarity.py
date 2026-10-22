"""SWEDEN C: the county null of nearest neighbours, the reference years and the published contract."""
import importlib.util
import json
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[3]
spec = importlib.util.spec_from_file_location("export_similarity",
                                              ROOT / "platform/publish/sweden/export_similarity.py")
export_similarity = importlib.util.module_from_spec(spec)
spec.loader.exec_module(export_similarity)
PUBLISHED = ROOT / "frontend/public/data/sweden/similarity/municipalities.json"


def test_county_null_counts_chance_partners_and_shuffles():
    # Two counties of two; each nearest neighbour shares the county.
    null = export_similarity.county_null(["A", "A", "B", "B"], [1, 0, 3, 2],
                                         np.array([[0, 0], [1000, 0], [0, 9000], [1000, 9000]], float))
    assert null["observed"] == 0
    assert null["random_partner"] == round(4 * 2 / 3, 1)  # two of three others lie in the other county
    assert 0 < null["permutation"]["share_at_most_observed"] <= 1
    assert null["geographic_nearest_km_median"] == 1


def test_turnout_refers_to_the_last_election():
    assert export_similarity.reference_year("turnout_riksdag_pct", 2024) == 2022
    assert export_similarity.reference_year("turnout_riksdag_pct", 2022) == 2022
    assert export_similarity.reference_year("dependency_ratio", 2024) == 2024


def test_published_similarity_contract():
    data = json.loads(PUBLISHED.read_text(encoding="utf-8"))
    rows = data["municipalities"]
    analysed = {r["code"] for r in rows if "neighbours" in r}
    assert len(rows) == data["summary"]["total"] == 290
    assert len(analysed) == data["summary"]["analysed"] == 280
    for r in rows:
        if "neighbours" in r:
            codes = [n[0] for n in r["neighbours"]]
            assert len(codes) == 5 and r["code"] not in codes and set(codes) <= analysed
        else:
            assert r["missing"]
    county = {r["code"]: r["county"] for r in rows}
    other = sum(county[r["neighbours"][0][0]] != r["county"] for r in rows if "neighbours" in r)
    assert other == data["summary"]["nearest_in_other_county"]
    null = data["summary"]["county_null"]
    assert other < null["permutation"]["interval_95"][0] <= null["random_partner"] <= 280
    assert all("reference_year" in f for f in data["features"])


checks = export_similarity.checks
GROUPS = ROOT / "frontend/public/data/sweden/similarity/groups.json"


def correlated(n=60, seed=1):
    rng = np.random.default_rng(seed)
    base = rng.standard_normal((n, 1))
    return np.hstack([base + 0.3 * rng.standard_normal((n, 1)) for _ in range(4)]) ** 3


def test_copula_null_is_seeded_and_keeps_each_indicator_s_values():
    x = correlated()
    first, again = (checks.copula_null(x, {2: 0.9}, 2, rounds=5) for _ in range(2))
    assert first == again and first["seed"] == checks.SEED
    assert first["share_at_least_observed"]["2"] == 1 / 6  # no draw reaches a silhouette of 0.9


def test_neighbour_stability_is_one_for_a_rescaled_copy():
    x = correlated()
    rows = {v["variant"]: v for v in checks.neighbour_stability(x, ["a", "b", "log_population", "c"], 4)}
    assert set(rows) == {"without_log_population", "without_commuting", "pca_space", "mahalanobis"}
    # Nothing to drop and all four components kept: the same neighbours.
    assert rows["without_commuting"] == {"variant": "without_commuting", "median_jaccard": 1.0,
                                         "first_neighbour_changed": 0.0}
    assert rows["pca_space"]["median_jaccard"] == 1.0


def test_temporal_ari_is_one_for_the_same_year():
    x = correlated()
    labels = checks.fit(x, 2, 2)[1]
    assert checks.temporal_ari(x, labels, 2, 2) == 1.0


def test_outcome_eta_separates_a_group_variable_from_noise_with_holm():
    labels = np.repeat([0, 1], 30)
    noise = np.random.default_rng(3).standard_normal(60)
    out = checks.outcome_eta({"k2": labels}, {"by_group": labels * 10.0 + noise * 0.01, "noise": noise}, rounds=99)
    rows = {r["outcome"]: r for r in out["results"]}
    assert rows["by_group"]["eta_squared"] == 1.0 and rows["by_group"]["p"] == 0.01
    assert rows["noise"]["eta_squared"] < rows["noise"]["null_95"]
    assert rows["by_group"]["p_holm"] == 0.02 and checks.holm([0.01, 0.04, 0.03]) == [0.03, 0.06, 0.06]


def test_metro_gradient_and_typology_share_measure_what_the_readings_claim():
    km = np.arange(40.0)
    gradient = checks.metro_gradient(-km, km, ["A", "B", "C", "D"] * 10, rounds=50)
    assert gradient["rho"] == -1.0 and gradient["ci95"][1] < 0
    labels = np.repeat([0, 1], 20)
    z = np.column_stack([labels, labels * 2.0])
    assert checks.typology_share(z, labels, rounds=20)["share"] == 1.0


def test_published_sensitivity_contract():
    g = json.loads(GROUPS.read_text(encoding="utf-8"))
    s = g["sensitivity"]
    for split in g["splits"]:
        # The copula keeps the correlation, so its bar is above the column shuffle's.
        assert split["copula_silhouette_95"] > split["null_silhouette_95"]
    assert len(s["neighbours"]["variants"]) == 4
    assert [y["year"] for y in s["temporal"]["years"]] == [2020, 2021, 2022, 2023]
    assert {r["outcome"] for r in s["outcomes"]["results"]} >= {"share_sd_pct", "library_visits_per_inhabitant"}
    assert set(s["centre_periphery"]["variants"]) == {"all_12", "without_log_population"}
    assert not {"log_population", "out_commuting_pct", "in_commuting_pct"} & set(s["skr_typology"]["indicators"])
