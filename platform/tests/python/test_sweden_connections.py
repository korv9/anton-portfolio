"""SWEDEN Connections: rank statistics on a fixed 20-row fixture, the interval's determinism under
the seed, Holm's adjustment, the assessment rules, the panel read from gold, and the two
pre-registered candidates (3.1 neighbour medians and SKR peer draws, 3.2 the change model)."""
import sys
from pathlib import Path

import duckdb
import numpy as np

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "platform/publish/sweden"))

import connections_preregistered as pre  # noqa: E402
import connections_stats as cs  # noqa: E402
import export_connections  # noqa: E402

# 20 municipalities: z drives both a and b, each also carries its own part; a small
# distinct offset breaks ties.
Z = np.array([3, 17, 8, 12, 1, 19, 6, 14, 10, 4, 16, 2, 11, 7, 18, 9, 13, 5, 20, 15], float)
A = Z + np.array([5, -3, 2, 7, -6, 1, 4, -2, 6, -4, 0, 3, -5, 8, -1, 2, -7, 6, -3, 1], float) + np.arange(20) / 100
B = Z + np.array([-4, 6, 1, -2, 7, -5, 3, 0, -6, 5, 2, -1, 4, -3, 6, -7, 1, 8, -2, 0], float) - np.arange(20) / 100


def test_spearman_matches_the_rank_difference_formula():
    assert len(set(A)) == len(set(B)) == 20
    d = cs.ranks(A) - cs.ranks(B)
    n = len(A)
    assert np.isclose(cs.spearman(A, B), 1 - 6 * (d ** 2).sum() / (n * (n * n - 1)))
    assert list(cs.ranks(np.array([1.0, 2.0, 2.0, 3.0]))) == [0, 1.5, 1.5, 3]


def test_partial_rho_matches_the_first_order_formula():
    rab, raz, rbz = cs.spearman(A, B), cs.spearman(A, Z), cs.spearman(B, Z)
    expected = (rab - raz * rbz) / np.sqrt((1 - raz ** 2) * (1 - rbz ** 2))
    assert np.isclose(cs.partial(A, B, [Z]), expected)
    assert cs.partial(A, B, [Z]) < rab  # the shared driver removed


def test_intervals_and_permutation_repeat_under_the_seed():
    county = np.repeat(["01", "03", "04", "05"], 5)
    stat = lambda i: cs.partial(A[i], B[i], [Z[i]])  # noqa: E731
    for groups in (None, county):
        first = cs.interval(stat, 20, np.random.default_rng(7), groups)
        assert first == cs.interval(stat, 20, np.random.default_rng(7), groups)
        assert -1 <= first[0] <= first[1] <= 1
    p = cs.permutation_p(A, B, [Z], np.random.default_rng(7))
    assert p == cs.permutation_p(A, B, [Z], np.random.default_rng(7)) and 0 < p <= 1


def test_holm_steps_down_in_input_order():
    assert np.allclose(cs.holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06])
    assert cs.holm([0.5, 0.9]) == [1.0, 1.0]


def test_assessment_needs_both_years_on_one_side():
    rule = export_connections.replicated
    assert rule([[0.03, 0.3], [0.01, 0.2]]) == "robust"
    assert rule([[-0.3, -0.03], [-0.2, -0.01]]) == "robust"
    assert rule([[0.03, 0.3], [-0.15, 0.1]]) == "uncertain"
    assert rule([[0.03, 0.3], [-0.3, -0.01]]) == "uncertain"
    assert rule([[-0.1, 0.3], [-0.15, 0.1]]) == "not_supported"


def test_panel_reads_gold_and_names_why_visits_are_missing():
    con = duckdb.connect()
    con.sql("create schema gold")
    con.sql("""create table gold.mart_municipality_year_cross_subject as select * from (values
               ('0114', 'Upplands Väsby', 2024, 1000.0, 300000.0, 41.2, 1000.0, 2500),
               ('0115', 'Vallentuna', 2024, 2000.0, 250000.0, 30.0, 2000.0, null),
               ('1230', 'Staffanstorp', 2024, 3000.0, 280000.0, 35.0, 3000.0, null),
               ('0116', 'Österåker', 2023, 3000.0, 1.0, null, 3000.0, 1)) as t(municipality_code,
               municipality_name, year, population, median_earned_income_sek,
               similarity_post_secondary_25_64_pct, library_population, library_visits)""")
    con.sql("""create table gold.fct_municipal_similarity as select * from (values
               ('0114', 2024, 20.0, 60.0)) as t(municipality_code, year, in_commuting_pct, out_commuting_pct)""")
    con.sql("""create table gold.fct_library_municipality_year as select * from (values
               ('0114', 2024, []::varchar[]),
               ('1230', 2024, ['visits: 0 with staffed service points', 'activities: an organisation did not report']))
               as t(municipality_code, year, set_to_missing)""")
    rows = export_connections.panel(con, 2024)
    assert [r["code"] for r in rows] == ["0114", "0115", "1230"]
    assert rows[0]["visits_rate"] == 2.5 and rows[0]["in_commuting_pct"] == 20.0
    assert np.isclose(rows[0]["log_population"], np.log(1000))
    assert [r["missing"] for r in rows] == [None, "no row in KB's statistics", "visits: 0 with staffed service points"]


def test_neighbour_median_needs_three_values_and_peers_stay_in_their_group():
    own = np.array([1.0, 2.0, np.nan, 4.0, 8.0, np.nan])
    sets = np.array([[1, 3, 4, 2, 5], [0, 3, 4, 2, 5], [0, 1, 3, 4, 5], [0, 1, 2, 4, 5], [0, 1, 2, 3, 5], [0, 1, 2, 3, 4]])
    median = pre.peer_median(own, sets)
    assert median[0] == 4.0 and median[1] == 4.0  # three values each: 2, 4, 8 and 1, 4, 8
    assert np.isnan(median[2]) and np.isnan(median[5])  # no own value
    group = np.array(["a"] * 6 + ["b"] * 7 + ["c"] * 3)
    eligible = np.array([(group == g).sum() > pre.NEIGHBOURS for g in group])
    sets = pre.peer_sets(group, eligible, np.random.default_rng(1))
    assert (sets == pre.peer_sets(group, eligible, np.random.default_rng(1))).all()
    for i in np.flatnonzero(eligible):
        assert i not in sets[i] and len(set(sets[i])) == 5 and (group[sets[i]] == group[i]).all()


def test_change_model_recovers_an_exact_elasticity():
    # Visits move as population squared times the square root of income: β = 2 and 0.5.
    rows = []
    for k in range(12):
        code = f"{(k % 4) + 1:02d}{k:02d}"
        for year in range(2014, 2025):
            pop = 1000 * (1 + 0.01 * k) ** (year - 2014) * (1 + k)
            income = 200000 * (1 + 0.003 * ((k * 7) % 5) + 0.002 * (year > 2019) * k) ** (year - 2014)
            rows.append(f"('{code}', {year}, {pop ** 2 * income ** 0.5 / 1e6}, {pop}, {income})")
    con = duckdb.connect()
    con.sql("create schema gold")
    con.sql(f"""create table gold.mart_municipality_year_cross_subject as select * from (values {', '.join(rows)})
               as t(municipality_code, year, library_visits, population, median_earned_income_sek)""")
    relationship = pre.change_model(con)
    for period in relationship["result"]["periods"]:
        assert period["n"] == 12
        assert [c["beta"] for c in period["coefficients"]] == [2.0, 0.5]
    assert relationship["assessment"] == "robust"
