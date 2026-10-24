"""The feed's provenance file: a path resolves to its delivery pattern and the lineage behind
it, an unresolved path stays null, and the committed file matches the posts and the graph."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "platform/architecture"))

import feed_provenance as fp  # noqa: E402

GRAPH = {
    "generated_at": "2026-10-08T00:00:00+00:00",
    "nodes": [
        {"id": "src:scb", "label": "SCB", "type": "source", "layer": "source", "url": "https://scb.se"},
        {"id": "raw:scb", "label": "scb", "type": "raw", "layer": "raw"},
        {"id": "dbt:fct_tax", "label": "fct_tax", "type": "gold", "layer": "gold"},
        {"id": "out:taxes/*.json", "label": "taxes/*.json", "type": "delivery", "layer": "delivery",
         "published_by": [{"path": "platform/publish/export_taxes.py", "legacy": False}]},
        {"id": "out:taxes/sweden.json", "label": "taxes/sweden.json", "type": "delivery",
         "layer": "delivery", "published_by": []},
    ],
    "edges": [
        {"source": "src:scb", "target": "raw:scb", "type": "lineage"},
        {"source": "raw:scb", "target": "dbt:fct_tax", "type": "lineage"},
        {"source": "dbt:fct_tax", "target": "out:taxes/*.json", "type": "delivery"},
    ],
}
CHECKS = [{"quality_check_id": "tax_ok", "dataset_id": "gold.fct_tax", "status": "pass"},
          {"quality_check_id": "other", "dataset_id": "gold.fct_other", "status": "fail"}]


def test_a_path_resolves_to_its_most_specific_pattern_and_its_lineage():
    tests = {"fct_tax": ["unique(tax_key)", "not_null(tax_key)", "tax_sums"]}
    out = fp.build(["taxes/wedge.json", "taxes/sweden.json", "sweden/x.json"], GRAPH, tests, CHECKS)
    assert out["paths"] == {"taxes/wedge.json": "taxes/*.json",
                            "taxes/sweden.json": "taxes/sweden.json", "sweden/x.json": None}
    d = out["deliveries"]["taxes/*.json"]
    assert d["published_by"] == ["platform/publish/export_taxes.py"]
    assert d["models"] == [{"name": "fct_tax", "layer": "gold", "tests": 3}]
    assert d["test_kinds"] == ["not_null", "tax_sums", "unique"]
    assert d["raw"] == ["scb"] and d["origins"] == [{"label": "SCB", "url": "https://scb.se"}]
    assert [c["id"] for c in d["checks"]] == ["tax_ok"]
    # A pattern with no delivery edge has no models: nothing is invented for it.
    assert out["deliveries"]["taxes/sweden.json"]["models"] == []


def test_model_tests_read_column_model_and_singular_tests(tmp_path):
    (tmp_path / "models").mkdir()
    (tmp_path / "tests").mkdir()
    (tmp_path / "models/schema.yml").write_text(
        "models:\n  - name: m\n    data_tests: [one_row]\n    columns:\n"
        "      - name: k\n        data_tests: [unique, {relationships: {}}]\n", encoding="utf-8")
    (tmp_path / "tests/m_sums.sql").write_text("select * from {{ ref('m') }}", encoding="utf-8")
    assert fp.model_tests(tmp_path)["m"] == ["one_row", "unique(k)", "relationships(k)", "m_sums"]


def test_unknown_paths_are_named(tmp_path):
    (tmp_path / "catalog.json").write_text('{"files": [{"path": "r2/only.json"}]}', encoding="utf-8")
    (tmp_path / "here.json").write_text("{}", encoding="utf-8")
    assert fp.unknown_paths(["r2/only.json", "here.json", "nowhere.json"], tmp_path) == ["nowhere.json"]


def test_committed_file_matches_the_posts_and_the_graph():
    committed = json.loads(fp.OUT.read_text(encoding="utf-8"))
    paths = fp.post_sources()
    assert sorted(committed["paths"]) == sorted(paths)
    assert fp.unknown_paths(paths) == []
    graph = json.loads(fp.GRAPH.read_text(encoding="utf-8"))
    assert committed["graph_generated_at"] == graph["generated_at"]
