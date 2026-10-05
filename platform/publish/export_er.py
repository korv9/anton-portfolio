"""Export an entity–relationship model of the warehouse for the ER diagram page (#er).

Every relation on the page comes from the data or from a dbt test:

- Tables: every gold model and every seed in the warehouse (DuckDB), plus gold models declared in
  dbt but not built in the local warehouse (the JobTech models, which build in their own
  database); those carry columns and tests from the manifest and no row counts.
- Primary key: the smallest set of key-like columns (names ending in _key, _id or _code, or a
  known key name) whose values are unique and never empty, checked in the data. For tables not
  built locally, dbt's unique tests.
- Relations: a table refers to another when it holds that table's whole primary key (by name, or
  by one of the few aliases below, such as municipality_code → region_code), and the data agrees:
  the share of the child's distinct non-empty values that exist in the parent is measured and
  published as coverage. Below 90 % it is not a relation. dbt relationships tests are added
  where the data cannot be checked, and every relation says which basis it rests on.
- Party: no table lists the parties, but many tables carry the party code. It is drawn as a code
  shared across tables, not as a table.

    python platform/publish/export_er.py [--manifest path/to/manifest.json]

Writes frontend/public/data/schema/er.json.
"""
from __future__ import annotations

import argparse
import itertools
import json
import os
import sys
from datetime import date
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parents[2]
DATABASE = Path(os.environ.get("PORTFOLIO_DB", ROOT / "warehouse/portfolio.duckdb"))
OUT = ROOT / "frontend/public/data/schema/er.json"
MIN_COVERAGE = 0.9
KEY_NAMES = {"session", "bill", "designation", "point", "household_type", "spending_group",
             "topic", "archive", "slug", "month", "year", "source", "decision_key", "date_day",
             "party", "election_year", "survey_month"}
# Columns that hold another table's key under another name.
ALIASES = {
    "municipality_code": "region_code",
    "county_code": "region_code",
    "parent_diagnosis_code": "diagnosis_code",
    "parent_code": "tax_code",
    "report_session": "session",
    "start_date": "date_day",
    "end_date": "date_day",
    "vote_date": "date_day",
}
DOMAINS = {
    "shared": ("Shared dimensions", "Gemensamma dimensioner"),
    "welfare": ("Welfare", "Välfärd"),
    "parliament": ("Parliament", "Riksdagen"),
    "politics": ("Politics", "Politik"),
    "taxes": ("Taxes", "Skatter"),
    "news": ("News", "Nyheter"),
    "market": ("Job market", "Arbetsmarknad"),
    "jobs": ("Tech jobs", "IT-jobb"),
}


def keyish(col: str) -> bool:
    return col.endswith(("_key", "_id", "_code")) or col in KEY_NAMES or col in ALIASES


def kind_of(name: str, layer: str) -> str:
    if layer == "seed":
        return "seed"
    for prefix, kind in (("dim_", "dimension"), ("fct_", "fact"), ("bridge_", "bridge"),
                         ("mart_", "mart"), ("int_", "intermediate")):
        if name.startswith(prefix):
            return kind
    return "model"


def newest_manifest() -> Path:
    paths = sorted((ROOT / "platform/target").glob("**/manifest.json"), key=lambda p: p.stat().st_mtime)
    if not paths:
        raise SystemExit("No dbt manifest; run `dbt parse` in platform/ first")
    return paths[-1]


def q(name: str) -> str:
    return '"' + name.replace('"', '""') + '"'


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path)
    args = parser.parse_args()
    manifest = json.loads((args.manifest or newest_manifest()).read_text(encoding="utf-8"))
    con = duckdb.connect(str(DATABASE), read_only=True)

    nodes = {n["name"]: n for n in manifest["nodes"].values()
             if n["resource_type"] in ("model", "seed")
             and (n["resource_type"] == "seed" or n["fqn"][1] == "gold")}
    unique_tests: dict[str, list[list[str]]] = {}
    tested: set[tuple[str, str, str, str]] = set()
    for t in manifest["nodes"].values():
        meta = t.get("test_metadata") or {}
        attached = (t.get("attached_node") or "").split(".")[-1]
        if meta.get("name") == "unique" and attached:
            unique_tests.setdefault(attached, []).append([meta["kwargs"]["column_name"]])
        if meta.get("name") == "unique_combination_of_columns" and attached:
            unique_tests.setdefault(attached, []).append(meta["kwargs"]["combination_of_columns"])
        if meta.get("name") == "relationships" and attached:
            to = meta["kwargs"]["to"].split("'")[1]
            tested.add((attached, meta["kwargs"]["column_name"], to, meta["kwargs"]["field"]))

    built = {(s, t) for s, t in con.execute(
        "select table_schema, table_name from information_schema.tables "
        "where table_schema in ('gold', 'seeds')").fetchall()}

    tables: dict[str, dict] = {}
    for name, node in sorted(nodes.items()):
        layer = "seed" if node["resource_type"] == "seed" else "gold"
        schema = "seeds" if layer == "seed" else "gold"
        domain = node["fqn"][2] if layer == "gold" and len(node["fqn"]) > 3 else None
        if layer == "seed":
            domain = node["fqn"][1] if len(node["fqn"]) > 2 else "shared"
        domain = domain if domain in DOMAINS else ("politics" if domain == "elections" else "shared")
        is_built = (schema, name) in built
        if is_built:
            cols = [(c, t) for c, t in con.execute(
                "select column_name, data_type from information_schema.columns "
                "where table_schema = ? and table_name = ? order by ordinal_position",
                [schema, name]).fetchall()]
            rows = con.execute(f"select count(*) from {schema}.{q(name)}").fetchone()[0]
        else:
            cols = [(c, (v.get("data_type") or None)) for c, v in node["columns"].items()]
            rows = None
        tables[name] = {
            "id": name, "schema": schema, "layer": layer, "domain": domain,
            "kind": kind_of(name, layer), "built": is_built, "rows": rows,
            "description": (node.get("description") or "").strip().split("\n")[0][:240],
            "columns": [{"name": c, "type": t} for c, t in cols],
            "pk": [],
        }

    # Primary keys: smallest unique, never-empty set of key-like columns, checked in the data.
    for name, t in tables.items():
        if not t["built"]:
            keys = sorted(unique_tests.get(name, []), key=len)
            t["pk"] = keys[0] if keys else []
            t["pk_basis"] = "tested" if keys else None
            continue
        cols = [c["name"] for c in t["columns"]]
        candidates = [c for c in cols if keyish(c)] or cols[:1]
        rows = t["rows"]
        found = None
        for size in (1, 2, 3):
            for combo in itertools.combinations(candidates, size):
                if (size == 2 and len(candidates) > 16) or (size == 3 and len(candidates) > 10):
                    break
                tuple_sql = ", ".join(q(c) for c in combo)
                nulls = " or ".join(f"{q(c)} is null" for c in combo)
                distinct, empty = con.execute(
                    f"select count(distinct ({tuple_sql})), count(*) filter (where {nulls}) "
                    f"from {t['schema']}.{q(name)}").fetchone()
                if rows and distinct == rows and empty == 0:
                    found = list(combo)
                    break
            if found:
                break
        t["pk"] = found or []
        t["pk_basis"] = "data" if found else None

    # Which table owns a key: gold dimensions first, then other gold tables, then seeds.
    rank = {"dimension": 0, "fact": 1, "bridge": 2, "model": 3, "intermediate": 4, "mart": 5, "seed": 6}
    owners: dict[tuple[str, ...], str] = {}
    for name, t in sorted(tables.items(), key=lambda kv: (rank[kv[1]["kind"]], -(kv[1]["rows"] or 0))):
        key = tuple(t["pk"])
        # Marts are reports, not entities others point to; a one-row table owns nothing.
        if key and t["kind"] != "mart" and (t["rows"] or 2) > 1 and key not in owners:
            if all(keyish(c) or c == "date_day" for c in key):
                owners[key] = name

    dim_keys = {k[0] for k, owner in owners.items()
                 if len(k) == 1 and tables[owner]["kind"] in ("dimension", "seed")}

    def dim_key(col: str) -> bool:
        return col in dim_keys or ALIASES.get(col) in dim_keys

    relations = []
    seen = set()
    for child, t in sorted(tables.items()):
        if t["layer"] == "seed":
            continue
        cols = {c["name"] for c in t["columns"]}
        for key, parent in owners.items():
            if parent == child:
                continue
            # Each parent key column must be in the child under its own name or an alias.
            options = []
            for k in key:
                names = [c for c in cols if c == k or ALIASES.get(c) == k]
                options.append(names)
            if not all(options):
                continue
            for combo in itertools.product(*options):
                if len(set(combo)) < len(combo):
                    continue
                if list(combo) == t["pk"] and len(combo) == 1 and tables[parent]["kind"] != "dimension":
                    # Same key on both sides and the parent is not a dimension: a sibling, not a reference.
                    continue
                # A composite key whose every column already points at a dimension is just shared
                # coordinates (two facts on the same region, period and sex), not a reference.
                if len(combo) > 1 and all(dim_key(c) for c in combo):
                    continue
                basis = []
                coverage = None
                if t["built"] and tables[parent]["built"]:
                    ctuple = ", ".join(f"c.{q(c)}" for c in combo)
                    join = " and ".join(f"cast(c.{q(c)} as varchar) = cast(p.{q(k)} as varchar)"
                                        for c, k in zip(combo, key))
                    notnull = " and ".join(f"c.{q(c)} is not null" for c in combo)
                    total, matched = con.execute(
                        f"select count(distinct ({ctuple})), "
                        f"count(distinct ({ctuple})) filter (where exists (select 1 from "
                        f"{tables[parent]['schema']}.{q(parent)} p where {join})) "
                        f"from {t['schema']}.{q(child)} c where {notnull}").fetchone()
                    if not total:
                        continue
                    coverage = matched / total
                    if coverage < MIN_COVERAGE:
                        continue
                    basis.append("data")
                if any((child, c, parent, k) in tested for c, k in zip(combo, key)):
                    basis.append("tested")
                if not basis:
                    continue
                ident = (child, tuple(combo), parent)
                if ident in seen:
                    continue
                seen.add(ident)
                one = sorted(combo) == sorted(t["pk"])
                relations.append({
                    "from": child, "from_cols": list(combo), "to": parent, "to_cols": list(key),
                    "cardinality": "one-to-one" if one else "many-to-one",
                    "basis": basis, "coverage": None if coverage is None else round(coverage, 4),
                })

    # dbt relationships tests the data could not check (tables not built locally).
    for child, col, parent, field in sorted(tested):
        if child not in tables or parent not in tables:
            continue
        if any(r["from"] == child and r["to"] == parent and col in r["from_cols"] for r in relations):
            continue
        relations.append({"from": child, "from_cols": [col], "to": parent, "to_cols": [field],
                          "cardinality": "many-to-one", "basis": ["tested"], "coverage": None})

    # Tables nothing refers to and that refer to nothing are left out of the diagram's lines but
    # stay in the list; seeds stay only when a gold table points at them.
    used_seeds = {r["to"] for r in relations if tables[r["to"]]["layer"] == "seed"}
    out_tables = [t for t in tables.values() if t["layer"] == "gold" or t["id"] in used_seeds]
    for t in out_tables:
        if t["layer"] == "seed":
            users = {tables[r["from"]]["domain"] for r in relations if r["to"] == t["id"]}
            if len(users) == 1:
                t["domain"] = users.pop()
    party_tables = sorted(t["id"] for t in out_tables
                          if any(c["name"] in ("party", "party_a", "party_b") for c in t["columns"]))
    values: set[str] = set()
    for name in party_tables:
        t = tables[name]
        if t["built"] and "party" in {c["name"] for c in t["columns"]}:
            values |= {p for (p,) in con.execute(
                f"select distinct cast(party as varchar) from {t['schema']}.{q(name)} where party is not null").fetchall()}

    out = {
        "generated": date.today().isoformat(),
        "method": {
            "tables": "Every gold model and every seed a gold table refers to. Tables not built in the local warehouse take their columns and keys from dbt.",
            "keys": "A primary key is the smallest set of key-like columns whose values are unique and never empty in the data.",
            "relations": f"A table refers to another when it holds that table's whole primary key and at least {int(MIN_COVERAGE * 100)} % of its distinct values exist there. Coverage is the measured share.",
            "party": "Party is a code shared by many tables; no table lists the parties.",
        },
        "domains": [{"key": k, "en": v[0], "sv": v[1]} for k, v in DOMAINS.items()],
        "tables": sorted(out_tables, key=lambda t: (t["domain"], rank[t["kind"]], t["id"])),
        "relations": sorted(relations, key=lambda r: (r["from"], r["to"])),
        "shared_codes": [{"code": "party", "tables": party_tables, "values": sorted(values)}],
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    by_basis: dict[str, int] = {}
    for r in relations:
        by_basis["+".join(r["basis"])] = by_basis.get("+".join(r["basis"]), 0) + 1
    print(f"{len(out_tables)} tables, {len(relations)} relations {by_basis}, "
          f"{sum(1 for t in out_tables if t['pk'])} with a key")
    return 0


if __name__ == "__main__":
    sys.exit(main())
