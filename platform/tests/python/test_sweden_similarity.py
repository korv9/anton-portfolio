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


def test_connections_reads_c_and_d_from_the_cross_subject_mart():
    import duckdb

    spec = importlib.util.spec_from_file_location("export_connections",
                                                  ROOT / "platform/publish/sweden/export_connections.py")
    connections = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(connections)
    con = duckdb.connect()
    con.sql("create schema gold")
    con.sql("""create table gold.mart_municipality_year_cross_subject as select * from (values
               ('0114', 2024, 1000.0, 300000.0, 41.234567::double, 1000.0, 2500, 1),
               ('0115', 2024, 2000.0, 250000.0, null, null, 100, 1),
               ('0116', 2023, 3000.0, 1.0, 1.0, 3000.0, 1, 1)) as t(municipality_code, year,
               similarity_population, similarity_median_earned_income_sek,
               similarity_post_secondary_25_64_pct, library_population, library_visits,
               library_service_points)""")
    rows = connections.panel(con, 2024)
    assert [r["code"] for r in rows] == ["0114", "0115"]
    assert rows[0] == {"code": "0114", "log_population": 6.9078, "median_earned_income_sek": 300000.0,
                       "post_secondary_25_64_pct": 41.2346, "visits_rate": 2.5, "service_points_rate": 10.0}
    # No population for D's rates: the municipality stays, without rates, and is counted as excluded.
    assert rows[1]["visits_rate"] is None and rows[1]["post_secondary_25_64_pct"] is None
