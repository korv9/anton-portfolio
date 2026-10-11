"""Check public-data exports and local Parquet before upload or offload."""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))

from common import PUBLIC  # noqa: E402

CONTRACTS = {
    "welfare": {
        "indicators": list, "regions": list, "county-year": list, "headlines": list,
        "panel-county-year": list, "national-month": list, "ess-countries": list,
        "datasets": list, "run": {"exported_at", "dbt", "sources", "rows", "parquet_rows"},
    },
    "parliament": {
        "now": {"generated_at", "election", "government", "latest_session"},
        "elections": {"years", "results", "party_names"}, "polls": {"polls", "party_names"},
        "sessions": {"sessions", "party_record", "party_pairs", "government_record"},
        "studies": {"generated_at", "latest", "per_year", "recent_laws"},
        "issues": {"issues", "speech_link_coverage", "notes"},
    },
    "taxes": {
        "sweden": {"types", "columns", "rows", "source"},
        "countries": {"types", "countries", "columns", "rows", "source"},
        "wedge": {"year", "countries", "latest", "series_columns", "series", "source"},
        "municipalities": {"year", "municipalities", "source"},
        "decisions": {"decisions", "components", "method"},
        "household": {"year", "households", "source"},
    },
}


def validate(public: Path = PUBLIC) -> None:
    def reject_constant(value):
        raise ValueError(f"Non-finite JSON number: {value}")

    def read(relative):
        return json.loads((public / relative).read_text(encoding="utf-8"),
                          parse_constant=reject_constant)

    for subject, contracts in CONTRACTS.items():
        for name, contract in contracts.items():
            payload = read(f"{subject}/{name}.json")
            if contract is list:
                assert isinstance(payload, list) and payload, f"Empty {subject}/{name}"
            else:
                assert isinstance(payload, dict) and contract <= payload.keys(), f"{subject}/{name} contract"
            if isinstance(payload, dict) and "columns" in payload and "rows" in payload:
                assert payload["rows"] and all(len(row) == len(payload["columns"])
                                               for row in payload["rows"]), f"{subject}/{name} columns"

    tests = read("welfare/run.json")["dbt"]["tests"]
    assert tests["pass"] > 0 and not any(tests.get(k, 0) for k in ("fail", "error", "skipped")), tests

    import duckdb

    con = duckdb.connect()
    try:
        for entry in read("welfare/datasets.json"):
            path = public / entry["path"]
            assert path.resolve().is_relative_to(public.resolve()), path
            assert con.execute("select count(*) from read_parquet(?)", [str(path)]).fetchone()[0] == entry["rows"], path
            columns = con.execute("describe select * from read_parquet(?)", [str(path)]).fetchall()
            assert [c[0] for c in columns] == [c["name"] for c in entry["columns"]], path
        for source, rows in read("welfare/run.json")["parquet_rows"].items():
            path = public / f"parquet/welfare_indicator/source={source}/part-0.parquet"
            assert con.execute("select count(*) from read_parquet(?)", [str(path)]).fetchone()[0] == rows, path
        path = public / "parquet/parliament_roll_calls/part-0.parquet"
        assert con.execute("select count(*) from read_parquet(?)", [str(path)]).fetchone()[0] > 0, path
    finally:
        con.close()


if __name__ == "__main__":
    validate()
    print("Public-data JSON and Parquet contracts passed")
