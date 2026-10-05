"""Build the Data Constellation: one graph of the whole platform, from sources to products.

    python platform/architecture/build_graph.py

Writes frontend/public/data/architecture/graph.json. Nothing in it is drawn by hand in React:

- dbt models, seeds and sources, and the lineage between them, come from dbt's manifest
  (platform/target/manifest.json; `dbt parse` is run when it is missing). Models dbt has switched
  off by default (the job-ad clustering marts) are included and marked `enabled: false`.
- Keys, table kinds (fact, dimension, mart …), row counts and the relationships between tables
  come from the ER export (frontend/public/data/schema/er.json, export_er.py), where every
  relation is either measured in the data or a dbt relationships test.
- Origins, ingestion, ML stages, publishers, products and shared infrastructure come from the
  small registry (registry.py). The dbt tables a publisher reads are found in its source code.
- Delivery nodes are the registry's output patterns, with the files on disk that match them.
  A product consumes a delivery node when its frontend code names one of those files.

Node ids: src:<origin>, ingest:<id>, raw:<dbt source>, dbt:<model or seed>, ml:<id>,
out:<pattern>, app:<product>, infra:<id>. Edge types: lineage (data is built from data),
relationship (a key joins two tables; logical, not a build step), delivery (a published file
is written from a table), frontend-consumption (a page reads a file) and infrastructure (a
stage runs on a shared component). validate() checks the result; the build fails on an error.
"""
from __future__ import annotations

import fnmatch
import json
import re
import subprocess
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))

import registry  # noqa: E402

PLATFORM = ROOT / "platform"
PUBLIC = ROOT / "frontend/public/data"
MANIFEST = PLATFORM / "target/manifest.json"
ER = PUBLIC / "schema/er.json"
OUT = PUBLIC / "architecture/graph.json"

# Left to right on the map. Seeds sit with raw data: reference inputs the warehouse reads.
LAYERS = ["source", "ingestion", "raw", "bronze", "silver", "ml", "gold", "delivery", "frontend"]
NODE_TYPES = {"source", "ingestion", "raw", "seed", "bronze", "silver", "ml", "gold", "delivery",
              "frontend", "shared"}
EDGE_TYPES = {"lineage", "relationship", "delivery", "frontend-consumption", "infrastructure"}
MAX_COLUMNS = 40
DATA_PATH = re.compile(r"""[`'"]((?:symbolic|jobs|welfare|taxes|politics|parliament|debates|gold|ml|products|"""
                       r"""schema|parquet|discovery|reports)/[A-Za-z0-9_./${}\-]*)""")


# ---------------------------------------------------------------------------- helpers


def pattern_regex(pattern: str) -> re.Pattern:
    """A path pattern as a regex: '**' spans directories, '*' stays within one."""
    parts = re.split(r"(\*\*|\*)", pattern)
    body = "".join(".*" if p == "**" else "[^/]*" if p == "*" else re.escape(p) for p in parts)
    return re.compile(body + "$")


def literal_regex(literal: str) -> re.Pattern | None:
    """A data path written in frontend code as a regex over files. Template parts (`${…}`) match
    any one segment; a literal ending in '/' is a directory and matches what is under it. Bare
    top-level prefixes ('gold/', 'politics/') are too vague to count and give None."""
    literal = re.sub(r"\$\{[^}]*\}?", "*", literal)
    if literal.endswith("/"):
        if literal.count("/") < 2:
            return None
        return re.compile(re.escape(literal) + ".*$")
    parts = re.split(r"(\*)", literal)
    body = "".join("[^/]*" if p == "*" else re.escape(p) for p in parts)
    # A deep path without an extension is a prefix of partitioned files ("…/source" for
    # "…/source=fk/part-0.parquet").
    if literal.count("/") >= 2 and "." not in literal.rsplit("/", 1)[-1]:
        return re.compile(body + ".*$")
    return re.compile(body + "$")


def dbt_layer(path: str, resource_type: str) -> str:
    if resource_type == "seed":
        return "seed"
    for layer in ("bronze", "silver", "gold"):
        if path.startswith(f"models/{layer}/"):
            return layer
    return "silver"


def dbt_domain(path: str) -> str:
    parts = path.split("/")
    folder = parts[2] if parts[0] == "models" and len(parts) > 3 else (
        parts[1] if parts[0] == "seeds" and len(parts) > 2 else "")
    return registry.DBT_FOLDER_DOMAIN.get(folder, "shared")


def load_manifest(path: Path = MANIFEST) -> dict:
    if not path.is_file():
        subprocess.run(["dbt", "parse", "--profiles-dir", "."], cwd=PLATFORM, check=True)
    return json.loads(path.read_text(encoding="utf-8"))


def public_files(root: Path = PUBLIC) -> list[str]:
    """The site's data files on disk, and those the catalogue lists that live only on R2."""
    on_disk = {p.relative_to(root).as_posix() for p in root.rglob("*")
               if p.is_file() and not p.name.startswith(".")}
    catalog = root / "catalog.json"
    if catalog.is_file():
        on_disk |= {f["path"] for f in json.loads(catalog.read_text(encoding="utf-8"))["files"]}
    return sorted(f for f in on_disk if not f.startswith("architecture/"))


def code_paths(paths: list[str]) -> set[str]:
    """Every data path literal in the given frontend files and folders."""
    found: set[str] = set()
    for entry in paths:
        target = ROOT / entry
        files = [target] if target.is_file() else sorted(target.rglob("*.ts*"))
        for f in files:
            found.update(DATA_PATH.findall(f.read_text(encoding="utf-8")))
    return found


def script_inputs(path: Path, names: set[str]) -> list[str]:
    """dbt tables a script names: schema-qualified ("gold.fct_x") or as a quoted name."""
    text = path.read_text(encoding="utf-8")
    return sorted(n for n in names if re.search(rf"\b(?:gold|silver|bronze|seeds)\.{re.escape(n)}\b", text)
                  or re.search(rf"[\"']{re.escape(n)}[\"']", text))


# ---------------------------------------------------------------------------- the graph


def build(manifest: dict, er: dict, files: list[str], frontend_paths=code_paths) -> dict:
    nodes: dict[str, dict] = {}
    edges: list[dict] = []

    def node(id_, **fields):
        if id_ in nodes:
            raise ValueError(f"duplicate node id {id_}")
        nodes[id_] = {"id": id_, **fields}

    def edge(source, target, type_, **fields):
        edges.append({"source": source, "target": target, "type": type_, **fields})

    # Shared infrastructure.
    for s in registry.SHARED:
        node(f"infra:{s['id']}", label=s["label"], type="shared", layer="shared", domain="shared",
             path=s["path"], description=s["description"])
    edge("infra:catalog", "infra:r2", "infrastructure")

    # Origins and ingestion.
    for o in registry.ORIGINS:
        node(f"src:{o['id']}", label=o["label"], type="source", layer="source", domain=o["domain"],
             url=o["url"], description=o["description"])
    raw_producer: dict[str, str] = {}
    for i in registry.INGESTION:
        nid = f"ingest:{i['id']}"
        node(nid, label=i["path"].split("/")[-1], type="ingestion", layer="ingestion", domain=i["domain"],
             path=i["path"], description=i["description"])
        for o in i["origins"]:
            edge(f"src:{o}", nid, "lineage")
        for r in i["raw"]:
            raw_producer[r] = nid
        folder = ROOT / i["path"]
        if any("rawstore" in f.read_text(encoding="utf-8") for f in folder.glob("*.py")):
            edge(nid, "infra:rawstore", "infrastructure")
    ml_raw = {r: f"ml:{m['id']}" for m in registry.ML for r in m.get("raw", [])}
    ml_layer = {f"ml:{m['id']}": m.get("layer", "ml") for m in registry.ML}

    # dbt sources: one raw node per source, with its tables.
    sources = list(manifest["sources"].values()) + [
        n for group in manifest.get("disabled", {}).values() for n in group if n.get("resource_type") == "source"]
    disabled_sources = {n["source_name"] for group in manifest.get("disabled", {}).values() for n in group
                        if n.get("resource_type") == "source"}
    by_source: dict[str, list[dict]] = defaultdict(list)
    for s in sources:
        by_source[s["source_name"]].append(s)
    for name, tables in sorted(by_source.items()):
        first = tables[0]
        node(f"raw:{name}", label=name, type="raw", layer=ml_layer[ml_raw[name]] if name in ml_raw else "raw",
             domain=dbt_domain(first["original_file_path"]), path=f"platform/{first['original_file_path']}",
             description=(first.get("source_description") or "").strip(),
             tables=sorted({t["name"] for t in tables}), enabled=name not in disabled_sources)
        # dbt reads every raw source into the one DuckDB warehouse.
        edge(f"raw:{name}", "infra:warehouse", "infrastructure")
        if name in raw_producer:
            edge(raw_producer[name], f"raw:{name}", "lineage")
        if name in ml_raw:
            edge(ml_raw[name], f"raw:{name}", "lineage")

    # dbt models and seeds, including those switched off by default.
    er_tables = {t["id"]: t for t in er.get("tables", [])}
    dbt_nodes = [(n, True) for n in manifest["nodes"].values() if n["resource_type"] in ("model", "seed")]
    dbt_nodes += [(n, False) for group in manifest.get("disabled", {}).values() for n in group
                  if n.get("resource_type") in ("model", "seed")]
    names = set()
    for n, enabled in dbt_nodes:
        layer = dbt_layer(n["original_file_path"], n["resource_type"])
        t = er_tables.get(n["name"], {})
        columns = [c["name"] for c in t.get("columns", [])] or list(n.get("columns", {}))
        node(f"dbt:{n['name']}", label=n["name"], type=layer, layer="raw" if layer == "seed" else layer,
             domain=dbt_domain(n["original_file_path"]), path=f"platform/{n['original_file_path']}",
             description=(n.get("description") or t.get("description") or "").strip(),
             materialized=n.get("config", {}).get("materialized") if n["resource_type"] == "model" else "seed",
             kind=t.get("kind"), keys=t.get("pk") or [], rows=t.get("rows"),
             columns=columns[:MAX_COLUMNS], column_count=len(columns), enabled=enabled)
        names.add(n["name"])
    for n, _ in dbt_nodes:
        for dep in n.get("depends_on", {}).get("nodes", []):
            kind, _, *rest = dep.split(".")
            if kind in ("model", "seed"):
                edge(f"dbt:{rest[-1]}", f"dbt:{n['name']}", "lineage")
            elif kind == "source":
                edge(f"raw:{rest[0]}", f"dbt:{n['name']}", "lineage")

    # ML stages.
    for m in registry.ML:
        nid = f"ml:{m['id']}"
        node(nid, label=m["label"], type="ml", layer=m.get("layer", "ml"), domain=m["domain"], path=m["path"],
             description=m["description"])
        for i in m["inputs"]:
            edge(f"dbt:{i}", nid, "lineage")

    # Publishers and the delivery files they write.
    deliveries: dict[str, dict] = {}
    for p in registry.PUBLISHERS:
        auto = script_inputs(ROOT / p["path"], names)
        for out in p["outputs"]:
            nid = f"out:{out['pattern']}"
            if nid not in deliveries:
                regex = pattern_regex(out["pattern"])
                matched = [f for f in files if regex.match(f)]
                formats = Counter(f.rsplit(".", 1)[-1] for f in matched)
                deliveries[nid] = {"id": nid, "label": out["pattern"], "type": "delivery", "layer": "delivery",
                                   "domain": out.get("domain", p["domain"]), "path": f"frontend/public/data/{out['pattern']}",
                                   "files": len(matched), "formats": dict(formats), "published_by": [],
                                   "examples": matched[:3], "_matched": matched}
            d = deliveries[nid]
            d["published_by"].append({"path": p["path"], "legacy": bool(p.get("legacy"))})
            for i in out.get("inputs", auto):
                source = i if ":" in i else f"dbt:{i}"
                edge(source, nid, "delivery", via=p["path"])
    for d in deliveries.values():
        nodes[d["id"]] = {k: v for k, v in d.items() if k != "_matched"}
        if d["formats"].get("parquet"):
            edge(d["id"], "infra:r2", "infrastructure")
        edge(d["id"], "infra:catalog", "infrastructure")

    # Products and what they read.
    for prod in registry.PRODUCTS:
        nid = f"app:{prod['id']}"
        node(nid, label=prod["label"], type="frontend", layer="frontend", domain=prod["domain"],
             href=prod["href"], path=prod["frontend"][0], description=prod["description"])
        literals = [r for r in (literal_regex(x) for x in frontend_paths(prod["frontend"])) if r]
        for d in deliveries.values():
            if any(r.match(f) for r in literals for f in d["_matched"]):
                edge(d["id"], nid, "frontend-consumption")

    # Relationships between tables: logical joins, not build steps.
    for r in er.get("relations", []):
        a, b = f"dbt:{r['from']}", f"dbt:{r['to']}"
        if a in nodes and b in nodes:
            edge(a, b, "relationship", from_cols=r["from_cols"], to_cols=r["to_cols"],
                 cardinality=r.get("cardinality"), basis=r.get("basis"))

    # One edge per (source, target, type).
    seen, unique = set(), []
    for e in edges:
        key = (e["source"], e["target"], e["type"])
        if key not in seen:
            seen.add(key)
            unique.append(e)
    graph = {"nodes": sorted(nodes.values(), key=lambda n: n["id"]), "edges": unique}
    graph["domains"] = domain_summary(graph)
    graph["layers"] = LAYERS
    return graph


def domain_summary(graph: dict) -> list[dict]:
    out = []
    for d in registry.DOMAINS:
        own = [n for n in graph["nodes"] if n["domain"] == d["id"]]
        count = Counter(n["type"] for n in own)
        out.append({**d, "counts": {
            "sources": count["source"], "ingestion": count["ingestion"], "raw": count["raw"],
            "seeds": count["seed"], "models": count["bronze"] + count["silver"] + count["gold"],
            "gold": count["gold"], "ml": count["ml"], "delivery": count["delivery"],
            "products": count["frontend"]}})
    return out


def validate(graph: dict) -> list[str]:
    """Problems with the graph: duplicate ids, unknown types or domains, edges to nowhere, and
    lineage that runs right to left."""
    errors = []
    ids = [n["id"] for n in graph["nodes"]]
    errors += [f"duplicate node {i}" for i, c in Counter(ids).items() if c > 1]
    known = set(ids)
    domains = {d["id"] for d in registry.DOMAINS}
    order = {layer: i for i, layer in enumerate(LAYERS)}
    by_id = {n["id"]: n for n in graph["nodes"]}
    for n in graph["nodes"]:
        if n["type"] not in NODE_TYPES:
            errors.append(f"{n['id']}: unknown type {n['type']}")
        if n["domain"] not in domains:
            errors.append(f"{n['id']}: unknown domain {n['domain']}")
        if n["layer"] not in order and n["layer"] != "shared":
            errors.append(f"{n['id']}: unknown layer {n['layer']}")
    for e in graph["edges"]:
        if e["type"] not in EDGE_TYPES:
            errors.append(f"edge {e['source']}→{e['target']}: unknown type {e['type']}")
        for end in (e["source"], e["target"]):
            if end not in known:
                errors.append(f"edge {e['source']}→{e['target']}: no node {end}")
        if e["type"] in ("lineage", "delivery", "frontend-consumption") and \
                e["source"] in by_id and e["target"] in by_id:
            a, b = by_id[e["source"]]["layer"], by_id[e["target"]]["layer"]
            if a in order and b in order and order[a] > order[b]:
                errors.append(f"edge {e['source']}→{e['target']}: runs from {a} back to {b}")
    return errors


def register(path: Path) -> None:
    """Add the graph to the delivery catalogue, like the other exports."""
    sys.path.insert(0, str(PLATFORM / "publish/symbolic"))
    import export_symbolic

    export_symbolic.register([path])


def main() -> int:
    manifest = load_manifest()
    er = json.loads(ER.read_text(encoding="utf-8")) if ER.is_file() else {}
    for entry in [*(i["path"] for i in registry.INGESTION), *(m["path"] for m in registry.ML),
                  *(p["path"] for p in registry.PUBLISHERS), *(s["path"] for s in registry.SHARED),
                  *(f for p in registry.PRODUCTS for f in p["frontend"])]:
        if not (ROOT / entry).exists():
            raise SystemExit(f"registry names {entry}, which does not exist")
    graph = build(manifest, er, public_files())
    errors = validate(graph)
    if errors:
        raise SystemExit("graph is invalid:\n  " + "\n  ".join(errors[:30]))
    graph["generated_at"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    graph["dbt_version"] = manifest.get("metadata", {}).get("dbt_version")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(graph, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    register(OUT)
    count = Counter(n["type"] for n in graph["nodes"])
    edge_count = Counter(e["type"] for e in graph["edges"])
    print(f"{len(graph['nodes'])} nodes {dict(count)}; {len(graph['edges'])} edges {dict(edge_count)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
