"""portfolio.core reproduces what the scripts did by hand, byte for byte, so moving a script onto it
changes no published file."""
import hashlib
import json

import pytest

from portfolio.core import config, db, io

PAYLOAD = {"name": "Malmö", "values": [1, 2.5, None], "nested": {"ö": "ä"}}


def test_root_is_the_checkout_whatever_the_depth():
    assert (config.ROOT / "platform/pipeline.yml").is_file()
    assert config.PUBLIC == config.ROOT / "frontend/public/data"


def test_paths_keep_the_scripts_defaults_and_their_overrides(monkeypatch, tmp_path):
    assert config.WAREHOUSE == config.ROOT / "warehouse"
    monkeypatch.setenv("PORTFOLIO_DB", str(tmp_path / "x.duckdb"))
    assert config._env_path("PORTFOLIO_DB", config.WAREHOUSE / "portfolio.duckdb") == tmp_path / "x.duckdb"


def test_root_override_for_an_install_outside_the_checkout(monkeypatch, tmp_path):
    monkeypatch.setenv("PORTFOLIO_ROOT", str(tmp_path))
    assert config._repository() == tmp_path.resolve()


def test_compact_json_without_a_newline(tmp_path):
    # What the welfare, parliament, taxes and sfs exports write, as platform/lib/common.py did.
    new = io.write_json(tmp_path / "new.json", PAYLOAD, newline=False).read_bytes()
    assert new == json.dumps(PAYLOAD, ensure_ascii=False, separators=(",", ":")).encode("utf-8")


def test_indented_json_ends_in_one_lf_newline(tmp_path):
    new = io.write_json(tmp_path / "new.json", PAYLOAD, indent=2).read_bytes()
    assert new == (json.dumps(PAYLOAD, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def test_export_json_matches_the_exports_dump(tmp_path):
    # The text every export_*.py dump() wrote by hand.
    dumped = json.dumps(PAYLOAD, ensure_ascii=False, separators=(",", ":")) + "\n"
    assert io.write_json(tmp_path / "x.json", PAYLOAD).read_text(encoding="utf-8") == dumped


def test_hashes_and_reading(tmp_path):
    path = tmp_path / "crlf.json"
    raw = b'\xef\xbb\xbf{"a": 1}\r\n'
    path.write_bytes(raw)
    assert io.read_json(path) == {"a": 1}
    assert io.portable_sha(path) == hashlib.sha256(raw.replace(b"\r\n", b"\n")).hexdigest()
    assert io.raw_sha(path) == hashlib.sha256(raw).hexdigest()
    assert io.unwrap({"data": [1]}) == [1]


def test_load_env_never_overrides_the_environment(monkeypatch, tmp_path):
    env = tmp_path / ".env"
    env.write_text('export FIRST = "one"\n# comment\nSECOND=two\n', encoding="utf-8")
    monkeypatch.setenv("SECOND", "kept")
    monkeypatch.delenv("FIRST", raising=False)
    config.load_env(env)
    import os
    assert os.environ["FIRST"] == "one" and os.environ["SECOND"] == "kept"


def test_connect_is_read_only_by_default(tmp_path):
    duckdb = pytest.importorskip("duckdb")
    path = tmp_path / "w.duckdb"
    with db.connect(path, read_only=False) as con:
        con.execute("create table t as select 1 as x")
    with db.connect(path) as con:
        assert con.execute("select x from t").fetchone() == (1,)
        with pytest.raises(duckdb.Error):
            con.execute("create table u as select 2")
