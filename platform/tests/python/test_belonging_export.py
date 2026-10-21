"""SWEDEN D: coverage counts what gold left out and set to missing. The rules themselves (partial
sums and impossible zeros are missing) are dbt unit tests of fct_library_municipality_year in
platform/models/gold/sweden/belonging_similarity.yml."""
import importlib.util
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parents[3]
spec = importlib.util.spec_from_file_location("export_belonging", ROOT / "platform/publish/sweden/export_belonging.py")
export_belonging = importlib.util.module_from_spec(spec)
spec.loader.exec_module(export_belonging)


def test_coverage_counts_left_out_observations_and_missing_values():
    con = duckdb.connect()
    con.sql("create schema gold")
    con.sql("""create table gold.fct_library_observation as select * from (values
               ('0114', 1.0), (null, 9.0), (null, null), ('0114', null)) as t(municipality_code, value)""")
    con.sql("""create table gold.fct_library_municipality_year as select * from (values
               ('0114', 2020, ['active_borrowers: an organisation did not report']),
               ('0114', 2021, ['visits: 0 with staffed service points', 'active_borrowers: an organisation did not report']),
               ('0115', 2021, []::varchar[])) as t(municipality_code, year, set_to_missing)""")
    left_out, missing = export_belonging.coverage_counts(con)
    assert left_out == {"no municipality in Biblioteksdatabasen": 2, "no value": 1}
    assert missing == {"active_borrowers: an organisation did not report": 2, "visits: 0 with staffed service points": 1}


def test_change_on_a_balanced_panel():
    """Six municipalities in two counties, 2014–2025, log visits = municipality + year + 0.1 × service
    points, so the within slope is 0.1 exactly; 0330 has a repaired zero in 2025."""
    import math

    years = list(range(2014, 2026))
    rows = []
    for i, code in enumerate(("0114", "0115", "0117", "0305", "0319", "0330")):
        for y in years:
            sp = 3 + i + (y * (i + 1)) % 3 - (y >= 2017 and i % 2)
            visits = math.exp(8 + 0.3 * i + 0.02 * (2019 - y) + 0.1 * sp)
            rows.append({"code": code, "year": y, "service_points": sp, "population": 10_000 * (i + 1),
                         "visits": None if (code, y) == ("0330", 2025) else visits,
                         "service_points_rate": sp, "visits_rate": visits / 10_000 / (i + 1)})
    reasons = {("0330", 2025): ["visits: 0 with staffed service points"]}
    skr = {"0114": "A", "0115": "A", "0117": "A", "0305": "B", "0319": "B", "0330": "B"}
    out = export_belonging.change(rows, reasons, skr, years)
    assert out == export_belonging.change(rows, reasons, skr, years)  # the seed fixes every interval
    assert out["balanced_visits"]["municipalities"] == 5
    late = out["periods"][1]["visits"]
    assert (late["balanced"]["n"], late["paired"]["n"], late["zeros_restored"]["n"]) == (5, 5, 6)
    assert late["zeros_restored"]["to"] == late["paired"]["to"]
    full, early = out["within"]
    assert (full["municipalities"], early["municipalities"], full["counties"]) == (5, 6, 2)
    assert abs(full["log_visits_per_service_point"] - 0.1) < 1e-9
    assert all(abs(v - 0.1) < 1e-9 for v in full["ci95_county_bootstrap"])
    assert set(out["recovery"][1]["groups"]) == {"A", "B"} and out["recovery"][1]["groups"]["B"]["n"] == 2
