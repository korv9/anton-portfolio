"""portfolio.core reproduces what the scripts did by hand, byte for byte, so moving a script onto it
changes no published file."""
import json
import sys
from pathlib import Path

import pytest

from portfolio.core import config, db, io

sys.path.insert(0, str(config.PLATFORM / "lib"))
import common  # noqa: E402  (the helpers being replaced; removed in the last step)

PAYLOAD = {"name": "Malmö", "values": [1, 2.5, None], "nested": {"ö": "ä"}}


def test_root_is_the_checkout_whatever_the_depth():
    assert (config.ROOT / "platform/pipeline.yml").is_file()
    assert config.ROOT == common.ROOT
    assert config.PUBLIC == common.PUBLIC


def test_paths_keep_the_scripts_defaults_and_their_overrides(monkeypatch, tmp_path):
    assert config.WAREHOUSE == config.ROOT / "warehouse"
    monkeypatch.setenv("PORTFOLIO_DB", str(tmp_path / "x.duckdb"))
    assert config._env_path("PORTFOLIO_DB", config.WAREHOUSE / "portfolio.duckdb") == tmp_path / "x.duckdb"


def test_root_override_for_an_install_outside_the_checkout(monkeypatch, tmp_path):
    monkeypatch.setenv("PORTFOLIO_ROOT", str(tmp_path))
    assert config._repository() == tmp_path.resolve()


def test_compact_json_matches_common_write_json(tmp_path):
    old = common.write_json(tmp_path / "old.json", PAYLOAD).read_bytes()
    new = io.write_json(tmp_path / "new.json", PAYLOAD, newline=False).read_bytes()
    assert new == old


def test_indented_json_matches_common_write_json(tmp_path):
    old = common.write_json(tmp_path / "old.json", PAYLOAD, indent=2).read_bytes()
    assert io.write_json(tmp_path / "new.json", PAYLOAD, indent=2).read_bytes() == old


def test_export_json_matches_the_exports_dump(tmp_path):
    # The text every export_*.py dump() wrote by hand.
    dumped = json.dumps(PAYLOAD, ensure_ascii=False, separators=(",", ":")) + "\n"
    assert io.write_json(tmp_path / "x.json", PAYLOAD).read_text(encoding="utf-8") == dumped


def test_hashes_and_reading_match_common(tmp_path):
    path = tmp_path / "crlf.json"
    path.write_bytes(b'\xef\xbb\xbf{"a": 1}\r\n')
    assert io.read_json(path) == common.read_json(path) == {"a": 1}
    assert io.portable_sha(path) == common.portable_sha(path)
    assert io.raw_sha(path) == common.raw_sha(path)
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
