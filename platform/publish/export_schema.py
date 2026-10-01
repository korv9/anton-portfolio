"""Export the warehouse's data model to the site: every table, how they connect, example rows.

    python platform/publish/export_schema.py

JSON under frontend/public/data/schema/:
    models.json          every source, seed and model in the dbt project: layer, subject,
                         materialisation, description, columns with types and tests, what it
                         reads from and what reads from it, the keys that link it to other
                         tables (relationships tests), row count and its SQL
    samples/<name>.json  a few example rows of each table, strings shortened
    summary.json         the start page's four figures: models, tests, source tables, rows

Reads the dbt manifest (the newest under platform/target/) and the warehouse. Views in
bronze read raw files on demand, so they are sampled but not counted.
"""
from __future__ import annotations

import json
import os
import sys
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))

import duckdb  # noqa: E402

from common import PUBLIC, ROOT, write_json  # noqa: E402

DATABASE = Path(os.environ.get("PORTFOLIO_DB", ROOT / "warehouse/portfolio.duckdb"))
PLATFORM = ROOT / "platform"
OUT = PUBLIC / "schema"
SAMPLE_ROWS = 8
TEXT_LIMIT = 160
# Columns that join tables although their names do not say so.
KEY_NAMES = {"session", "bill", "report", "party", "year", "designation", "point",
             "household_type", "spending_group", "municipality_code", "parish_code",
             "country_code", "tax_code", "issue_key", "government_key"}


def manifest() -> dict:
    paths = sorted((PLATFORM / "target").glob("*/manifest.json"), key=lambda p: p.stat().st_mtime)
    if not paths:
        raise SystemExit("No dbt manifest under platform/target; run a dbt build or parse first")
    return json.loads(paths[-1].read_text(encoding="utf-8"))


def value(v):
    if isinstance(v, (datetime, date)):
        return v.isoformat()
    if isinstance(v, Decimal):
        return float(v)
    if isinstance(v, float):
        return round(v, 4)
    if isinstance(v, str) and len(v) > TEXT_LIMIT:
        return v[:TEXT_LIMIT] + "…"
    if isinstance(v, (list, tuple)):
        text = json.dumps([value(x) for x in v], ensure_ascii=False, default=str)
        return text if len(text) <= TEXT_LIMIT else text[:TEXT_LIMIT] + "…"
    if isinstance(v, dict):
        text = json.dumps(v, ensure_ascii=False, default=str)
        return text if len(text) <= TEXT_LIMIT else text[:TEXT_LIMIT] + "…"
    if isinstance(v, (bytes, bytearray)):
        return f"<{len(v)} bytes>"
    return v


def subject(node: dict) -> str:
    tags = [t for t in node.get("tags", []) if t != "serving"]
    if tags:
        return tags[0]
    parts = Path(node.get("original_file_path", "")).parts
    return parts[2] if len(parts) > 3 else "shared"


def tests_total(manifest: dict) -> int:
    return sum(1 for n in manifest["nodes"].values() if n["resource_type"] == "test")


def summary(nodes: list[dict], layers: dict, tests: int) -> dict:
    """The four figures the start page shows, so it need not load the whole schema."""
    return {
        "models": sum(1 for n in nodes if n["kind"] == "model"),
        "tests": tests,
        "sources": layers.get("source", 0),
        "rows": sum(n.get("rows") or 0 for n in nodes),
    }


def main() -> None:
    m = manifest()
    connection = duckdb.connect(str(DATABASE), read_only=True)
    columns_by_table: dict[tuple[str, str], list[tuple[str, str]]] = {}
    for schema, table, column, kind in connection.execute("""
            select table_schema, table_name, column_name, data_type
            from information_schema.columns order by table_schema, table_name, ordinal_position
            """).fetchall():
        columns_by_table.setdefault((schema, table), []).append((column, kind))
    kinds = {(s, t): k for s, t, k in connection.execute(
        "select table_schema, table_name, table_type from information_schema.tables").fetchall()}

    # Tests: per node, per column, and the relationships between tables.
    tests: dict[str, dict[str, list[str]]] = {}
    links: list[dict] = []
    for node in m["nodes"].values():
        if node["resource_type"] != "test":
            continue
        meta = node.get("test_metadata") or {}
        name = meta.get("name") or node["name"].split("_")[0]
        kwargs = meta.get("kwargs") or {}
        arguments = kwargs.get("arguments") or kwargs
        target = node.get("attached_node") or next(
            (d for d in node["depends_on"]["nodes"] if not d.startswith("test.")), None)
        if not target:
            continue
        column = node.get("column_name") or arguments.get("column_name") or ""
        label = name
        if name == "relationships":
            to = arguments.get("to", "")
            to_name = to.split("'")[1] if "'" in to else to
            label = f"relationships → {to_name}.{arguments.get('field')}"
            links.append({"from": target, "column": column,
                          "to": f"model.portfolio.{to_name}", "field": arguments.get("field")})
        elif name == "unique_combination":
            label = "unique (" + ", ".join(arguments.get("columns", [])) + ")"
        elif name == "accepted_values":
            label = "accepted values: " + ", ".join(map(str, arguments.get("values", [])))
        elif meta == {}:
            label = f"singular: {node['name']}"
        tests.setdefault(target, {}).setdefault(column, []).append(label)

    nodes = []
    all_nodes = {**m["nodes"], **m["sources"]}
    readers: dict[str, list[str]] = {}
    for key, node in all_nodes.items():
        for parent in (node.get("depends_on") or {}).get("nodes", []):
            readers.setdefault(parent, []).append(key)

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "samples").mkdir(exist_ok=True)
    for stale in (OUT / "samples").glob("*.json"):
        stale.unlink()

    for key, node in sorted(all_nodes.items()):
        kind = node["resource_type"]
        if kind not in ("model", "seed", "source"):
            continue
        if kind == "source":
            schema, name = "raw", f"{node['source_name']}.{node['name']}"
            relation = None
        else:
            schema, name = node["schema"], node.get("alias") or node["name"]
            relation = (schema, name)
        described = {c: v.get("description", "") for c, v in (node.get("columns") or {}).items()}
        found = columns_by_table.get(relation, []) if relation else []
        columns = [{"name": c, "type": t, "description": described.get(c, ""),
                    "tests": tests.get(key, {}).get(c, [])} for c, t in found]
        if not columns and described:
            columns = [{"name": c, "type": None, "description": d,
                        "tests": tests.get(key, {}).get(c, [])} for c, d in described.items()]

        rows = None
        sample = None
        table_kind = kinds.get(relation) if relation else None
        if relation and table_kind:
            quoted = f'"{schema}"."{name}"'
            if table_kind == "BASE TABLE":
                rows = connection.execute(f"select count(*) from {quoted}").fetchone()[0]
            try:
                cursor = connection.execute(f"select * from {quoted} limit {SAMPLE_ROWS}")
                header = [c[0] for c in cursor.description]
                sample = {"columns": header,
                          "rows": [[value(v) for v in row] for row in cursor.fetchall()]}
            except duckdb.Error as error:
                sample = {"columns": [], "rows": [], "error": str(error).splitlines()[0][:200]}
        external = (node.get("meta") or {}).get("external_location") or \
            (node.get("source_meta") or {}).get("external_location")
        entry = {
            "id": key,
            "name": name if kind != "source" else node["name"],
            "kind": kind,
            "schema": schema,
            "layer": "source" if kind == "source" else ("seed" if kind == "seed" else schema),
            "subject": node.get("source_name") if kind == "source" else subject(node),
            "materialized": (node.get("config") or {}).get("materialized") if kind == "model"
            else ("external files" if kind == "source" else "seed"),
            "relation_type": table_kind,
            "description": (node.get("description") or node.get("source_description") or "").strip(),
            "path": node.get("original_file_path"),
            "reads": [d for d in (node.get("depends_on") or {}).get("nodes", [])
                      if not d.startswith("test.")],
            "read_by": sorted(r for r in readers.get(key, []) if not r.startswith("test.")),
            "tests": tests.get(key, {}).get("", []),
            "columns": columns,
            "rows": rows,
            "sql": (node.get("raw_code") or "").strip() or None,
            "external": " ".join(external.split()) if external else None,
            "has_sample": bool(sample and sample["rows"]),
        }
        nodes.append(entry)
        if sample and (sample["rows"] or sample.get("error")):
            write_json(OUT / "samples" / f"{key.split('.', 1)[1]}.json", sample)

    # How each table joins what it reads: the key columns both have.
    by_id = {n["id"]: n for n in nodes}
    edges = []
    for n in nodes:
        mine = {c["name"] for c in n["columns"]}
        for parent in n["reads"]:
            theirs = {c["name"] for c in by_id.get(parent, {}).get("columns", [])}
            keys = sorted(c for c in mine & theirs
                          if c.endswith(("_key", "_id", "_code")) or c in KEY_NAMES)
            edges.append({"from": n["id"], "to": parent, "keys": keys})

    layers = {}
    for n in nodes:
        layers[n["layer"]] = layers.get(n["layer"], 0) + 1
    write_json(OUT / "models.json", {
        "generated_from": "dbt manifest and the DuckDB warehouse",
        "dbt_version": m["metadata"].get("dbt_version"),
        "layers": layers,
        "tests": tests_total(m),
        "links": [link for link in links if link["from"] in all_nodes],
        "edges": edges,
        "nodes": nodes,
    })
    write_json(OUT / "summary.json", summary(nodes, layers, tests_total(m)))
    print(f"schema: {len(nodes)} tables ({layers}), {len(links)} links, "
          f"{sum(1 for n in nodes if n['has_sample'])} with example rows")


if __name__ == "__main__":
    os.chdir(PLATFORM)  # bronze views read raw files by paths relative to platform/
    main()
