"""The Data Constellation graph: patterns, layer and domain assignment, dbt lineage extraction,
frontend route mapping, and validation of the committed graph."""
import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "platform/architecture"))

import build_graph as bg  # noqa: E402
import registry  # noqa: E402

GRAPH = ROOT / "frontend/public/data/architecture/graph.json"


def test_patterns_span_segments_only_with_double_star():
    assert bg.pattern_regex("symbolic/*.json").match("symbolic/summary.json")
    assert not bg.pattern_regex("symbolic/*.json").match("symbolic/a/b.json")
    assert bg.pattern_regex("politics/decisions/**").match("politics/decisions/2024-25/index.json")


def test_frontend_literals():
    assert bg.literal_regex("politics/decisions/${session}/index.json").match("politics/decisions/2024-25/index.json")
    assert bg.literal_regex("politics/parliament/").match("politics/parliament/boost.json")
    assert bg.literal_regex("parquet/welfare_indicator/source").match("parquet/welfare_indicator/source=fk/part-0.parquet")
    assert bg.literal_regex("gold/") is None  # too vague to count


def test_dbt_layer_and_domain():
    assert bg.dbt_layer("models/gold/symbolic/mart_symbol_atlas.sql", "model") == "gold"
    assert bg.dbt_layer("seeds/symbolic/symbols.csv", "seed") == "seed"
    assert bg.dbt_domain("models/silver/parliament/x.sql") == "politics"
    assert bg.dbt_domain("models/gold/market/x.sql") == "jobs"
    assert bg.dbt_domain("models/gold/shared/dim_date.sql") == "shared"
    assert bg.dbt_domain("seeds/role_patterns.csv") == "jobs"


def manifest():
    """A tiny manifest: a source, a staging model, a mart and a seed."""
    def model(name, path, deps):
        return {"resource_type": "model", "name": name, "original_file_path": path, "description": "",
                "config": {"materialized": "table"}, "columns": {}, "depends_on": {"nodes": deps}}
    return {
        "metadata": {"dbt_version": "test"},
        "sources": {"source.portfolio.symbolic.texts": {
            "resource_type": "source", "source_name": "symbolic", "name": "texts",
            "original_file_path": "models/bronze/symbolic/sources.yml", "source_description": "Gutenberg"}},
        "nodes": {
            "model.portfolio.stg": model("stg_symbolic_documents", "models/bronze/symbolic/stg.sql",
                                         ["source.portfolio.symbolic.texts"]),
            "model.portfolio.int_symbol_occurrences": model(
                "int_symbol_occurrences", "models/silver/symbolic/occ.py",
                ["model.portfolio.stg_symbolic_documents", "seed.portfolio.symbols"]),
            "model.portfolio.int_symbolic_documents": model(
                "int_symbolic_documents", "models/silver/symbolic/docs.py", ["model.portfolio.stg_symbolic_documents"]),
            "model.portfolio.mart_symbol_atlas": model(
                "mart_symbol_atlas", "models/gold/symbolic/mart.sql",
                ["model.portfolio.int_symbol_occurrences", "source.portfolio.symbolic_features.atlas_projection"]),
            "seed.portfolio.symbols": {"resource_type": "seed", "name": "symbols",
                                       "original_file_path": "seeds/symbolic/symbols.csv", "config": {},
                                       "depends_on": {"nodes": []}},
        },
        "disabled": {"source.portfolio.symbolic_features.atlas_projection": [{
            "resource_type": "source", "source_name": "symbolic_features", "name": "atlas_projection",
            "original_file_path": "models/bronze/symbolic/sources.yml"}]},
    }


def small_graph():
    files = ["symbolic/atlas.parquet", "symbolic/summary.json"]
    er = {"tables": [{"id": "mart_symbol_atlas", "kind": "mart", "pk": ["occurrence_id"], "rows": 10,
                      "columns": [{"name": "occurrence_id"}]}],
          "relations": [{"from": "mart_symbol_atlas", "to": "symbols", "from_cols": ["symbol_id"],
                         "to_cols": ["symbol_id"], "cardinality": "many-to-one", "basis": ["tested"]}]}
    def frontend(paths):
        return {"symbolic/atlas.parquet"} if "frontend/src/symbolic" in paths else set()
    return bg.build(manifest(), er, files, frontend_paths=frontend)


def ids(graph):
    return {n["id"]: n for n in graph["nodes"]}


def test_dbt_dependencies_become_lineage_edges():
    g = small_graph()
    lineage = {(e["source"], e["target"]) for e in g["edges"] if e["type"] == "lineage"}
    assert ("raw:symbolic", "dbt:stg_symbolic_documents") in lineage
    assert ("dbt:symbols", "dbt:int_symbol_occurrences") in lineage
    assert ("raw:symbolic_features", "dbt:mart_symbol_atlas") in lineage
    assert ("ml:symbolic-pipeline", "raw:symbolic_features") in lineage
    assert ("ingest:symbolic", "raw:symbolic") in lineage and ("src:gutenberg", "ingest:symbolic") in lineage


def test_relationships_are_their_own_edge_type():
    g = small_graph()
    rel = [e for e in g["edges"] if e["type"] == "relationship"]
    assert rel and rel[0]["source"] == "dbt:mart_symbol_atlas" and rel[0]["cardinality"] == "many-to-one"
    assert not any(e["type"] == "lineage" and e["target"] == "dbt:symbols" for e in g["edges"])


def test_delivery_and_frontend_consumption():
    g = small_graph()
    nodes = ids(g)
    assert nodes["out:symbolic/atlas.parquet"]["files"] == 1
    assert {"source": "dbt:mart_symbol_atlas", "target": "out:symbolic/atlas.parquet"}.items() <= next(
        e for e in g["edges"] if e["target"] == "out:symbolic/atlas.parquet" and e["type"] == "delivery").items()
    consumed = {(e["source"], e["target"]) for e in g["edges"] if e["type"] == "frontend-consumption"}
    assert consumed == {("out:symbolic/atlas.parquet", "app:symbolic")}
    assert nodes["dbt:mart_symbol_atlas"]["keys"] == ["occurrence_id"] and nodes["dbt:mart_symbol_atlas"]["kind"] == "mart"


def test_layers_and_domains_are_assigned():
    nodes = ids(small_graph())
    assert nodes["dbt:symbols"]["type"] == "seed" and nodes["dbt:symbols"]["layer"] == "raw"
    assert nodes["raw:symbolic_features"]["layer"] == "ml"
    assert nodes["dbt:mart_symbol_atlas"]["domain"] == "symbolic"
    assert nodes["app:symbolic"]["href"] == "#symbolic-atlas"


def test_validate_finds_problems():
    g = small_graph()
    assert bg.validate(g) == [] or all("no node" in e for e in bg.validate(g))
    broken = {"nodes": g["nodes"] + [g["nodes"][0]], "edges": g["edges"] + [
        {"source": "dbt:mart_symbol_atlas", "target": "dbt:stg_symbolic_documents", "type": "lineage"},
        {"source": "dbt:nowhere", "target": "app:symbolic", "type": "lineage"}]}
    errors = bg.validate(broken)
    assert any("duplicate" in e for e in errors)
    assert any("runs from gold back to bronze" in e for e in errors)
    assert any("no node dbt:nowhere" in e for e in errors)


def test_registry_entries_exist():
    for entry in [*(i["path"] for i in registry.INGESTION), *(m["path"] for m in registry.ML),
                  *(p["path"] for p in registry.PUBLISHERS), *(s["path"] for s in registry.SHARED),
                  *(f for p in registry.PRODUCTS for f in p["frontend"])]:
        assert (ROOT / entry).exists(), entry


@pytest.mark.skipif(not GRAPH.is_file(), reason="graph not built")
def test_committed_graph_is_valid_and_traceable():
    g = json.loads(GRAPH.read_text(encoding="utf-8"))
    assert bg.validate(g) == []
    up = {}
    for e in g["edges"]:
        if e["type"] in ("lineage", "delivery", "frontend-consumption"):
            up.setdefault(e["target"], set()).add(e["source"])

    def ancestors(x):
        seen, stack = set(), [x]
        while stack:
            for s in up.get(stack.pop(), ()):
                if s not in seen:
                    seen.add(s)
                    stack.append(s)
        return seen

    assert "src:gutenberg" in ancestors("app:symbolic")
    assert "src:riksdagen" in ancestors("app:politics")
    assert "src:arbetsformedlingen" in ancestors("app:jobs")
    assert "src:scb" in ancestors("app:welfare")
    for product in ("app:politics", "app:jobs", "app:welfare", "app:symbolic"):
        assert up.get(product), f"{product} consumes nothing"


def test_ai_act_product_traces_to_official_sources_and_the_riksdag():
    graph = json.loads((ROOT / "frontend/public/data/architecture/graph.json").read_text(encoding="utf-8"))
    edges = graph["edges"]
    reads = {e["source"] for e in edges if e["target"] == "app:ai_act" and e["type"] == "frontend-consumption"}
    assert "out:ai-act/obligations.json" in reads and "out:ai-act/politics/*.json" in reads
    assert any(e["source"] == "raw:riksdagen_speeches" for e in edges)
    assert any(e["target"] == "infra:legal" for e in edges)
