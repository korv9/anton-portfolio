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
