"""Raw files are checked on write with the bronze reader of their path (raw_contract.py)."""
import json
import re

import pytest

from portfolio.storage import raw_contract, rawstore


def test_the_inferred_list_names_exactly_the_tables_that_still_guess():
    guessing = {c.table for c in raw_contract.contracts() if not c.fixed}
    assert guessing == raw_contract.INFERRED, "fix a table's columns, then drop it from INFERRED"


def test_every_raw_reader_names_a_raw_path():
    assert all(c.globs for c in raw_contract.contracts())


def test_a_payload_its_reader_cannot_read_is_never_stored(tmp_path, monkeypatch):
    monkeypatch.setattr(rawstore, "RAW", tmp_path)
    good = json.dumps({"columns": [], "data": []}).encode()
    path = rawstore.store("scb", "population_year/part-1.json", good, url="https://example.org/a")
    with pytest.raises(ValueError, match="scb.population_year"):
        rawstore.store("scb", "population_year/part-1.json", b"{not json", url="https://example.org/a")
    assert path.read_bytes() == good
    line = json.loads((tmp_path / "scb" / "_manifest.jsonl").read_text().splitlines()[-1])
    assert line["contract"] == ["scb.population_year"]


def test_declared_columns_reject_a_value_of_the_wrong_type(tmp_path):
    file = tmp_path / "x.json"
    contract = raw_contract.Contract("t.t", "read_json", "read_json('@RAW@/x.json', columns = {'n': 'BIGINT'})",
                                     ("x.json",))
    assert contract.fixed
    file.write_text('{"n": "many"}')
    with pytest.raises(Exception):
        raw_contract._connection().sql(f"select count(columns(*)) from {contract.on(file)}").fetchall()


def test_a_path_no_bronze_table_reads_has_no_contract():
    assert raw_contract.check("nobody", "reads/this.json", b"{}") == []


def test_no_reader_reserves_far_more_memory_than_its_files_need():
    # DuckDB 2.0 allocates twice maximum_object_size per file it reads at once; 500 MB ran the
    # welfare build out of memory on 12 GB. The raw files are under 10 MB (fk's gzip expands).
    sizes = [int(size) for c in raw_contract.contracts()
             for size in re.findall(r"maximum_object_size\s*=\s*(\d+)", c.expression)]
    assert sizes and max(sizes) <= 256_000_000
