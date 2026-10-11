"""Validate exported contracts using committed JSON and tiny local Parquet fixtures."""
import json
import shutil
import sys
from pathlib import Path

import duckdb
import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "publish"))
import validate_public_data as validator


@pytest.fixture
def public(tmp_path):
    for subject, contracts in validator.CONTRACTS.items():
        (tmp_path / subject).mkdir()
        for name in contracts:
            shutil.copyfile(validator.PUBLIC / subject / f"{name}.json", tmp_path / subject / f"{name}.json")
    dataset = "parquet/welfare/sample.parquet"
    paths = [dataset, "parquet/welfare_indicator/source=scb/part-0.parquet",
             "parquet/parliament_roll_calls/part-0.parquet"]
    con = duckdb.connect()
    for relative in paths:
        path = tmp_path / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        con.execute("copy (select 1 as value union all select 2) to ? (format parquet)", [str(path)])
    con.close()
    (tmp_path / "welfare/datasets.json").write_text(json.dumps([
        {"path": dataset, "rows": 2, "columns": [{"name": "value"}]}]))
    run = json.loads((tmp_path / "welfare/run.json").read_text())
    run["parquet_rows"] = {"scb": 2}
    (tmp_path / "welfare/run.json").write_text(json.dumps(run))
    return tmp_path


def test_export_contracts_pass_then_refuse_wrong_row_count_and_nonfinite_json(public):
    validator.validate(public)
    path = public / "welfare/datasets.json"
    data = json.loads(path.read_text())
    data[0]["rows"] = 3
    path.write_text(json.dumps(data))
    with pytest.raises(AssertionError):
        validator.validate(public)
    data[0]["rows"] = 2
    path.write_text(json.dumps(data))
    path = public / "taxes/sweden.json"
    text = path.read_text(encoding="utf-8")
    path.write_text(text[:-1] + ',"invalid":NaN}', encoding="utf-8")
    with pytest.raises(ValueError, match="Non-finite"):
        validator.validate(public)
