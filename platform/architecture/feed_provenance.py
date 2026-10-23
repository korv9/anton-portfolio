"""Where each feed chart's numbers come from, for the trace panel of an opened card.

    python platform/architecture/feed_provenance.py

Reads, and never rebuilds:

- the `sources` each feed post declares (frontend/src/meaning/posts/*.tsx);
- the platform graph (frontend/public/data/architecture/graph.json, build_graph.py), for the
  delivery pattern a file belongs to, its publisher, the dbt models it is written from and the
  origins upstream of them;
- the dbt schema files (platform/models/**/*.yml) and singular tests (platform/tests/**/*.sql),
  for the tests on those models;
- the quality checks (frontend/public/data/quality/checks.json), for their last result.

Writes frontend/public/data/architecture/feed-provenance.json: one entry per data path. A path
with no delivery node in the graph maps to null, and the panel says "Lineage not recorded".
Run it after build_graph.py and whenever a post's sources change; a test fails
when the committed file no longer covers the posts. Freshness and run times are live (status/ingestion.json) and read in the browser.
"""
from __future__ import annotations

import json
import re
import sys
from collections import defaultdict
from pathlib import Path

import yaml

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from build_graph import PUBLIC, ROOT, pattern_regex  # noqa: E402

POSTS = ROOT / "frontend/src/meaning/posts"
GRAPH = PUBLIC / "architecture/graph.json"
CHECKS = PUBLIC / "quality/checks.json"
OUT = PUBLIC / "architecture/feed-provenance.json"
SOURCES = re.compile(r"sources:\s*\[([^\]]*)\]")
# Live objects on R2 that no release catalogues: the run status each pipeline run rewrites.
LIVE = {"status/ingestion.json": "platform/pipeline.py"}


def post_sources(root: Path = POSTS) -> list[str]:
    """Every data path the feed posts declare, in order of first appearance."""
    found: dict[str, None] = {}
    for f in sorted(root.glob("*.tsx")):
        for block in SOURCES.findall(f.read_text(encoding="utf-8")):
            found.update(dict.fromkeys(re.findall(r"'([^']+)'", block)))
    return list(found)


def unknown_paths(paths: list[str], root: Path = PUBLIC) -> list[str]:
    """Paths the site does not publish: neither on disk nor in the delivery catalogue."""
    catalog = json.loads((root / "catalog.json").read_text(encoding="utf-8"))
    listed = {f["path"] for f in catalog["files"]}
    return [p for p in paths if p not in listed and p not in LIVE and not (root / p).is_file()]


def model_tests(platform: Path = ROOT / "platform") -> dict[str, list[str]]:
    """dbt model -> its tests, as `name(column)` for column tests and `name` otherwise."""
    tests: dict[str, list[str]] = defaultdict(list)

    def names(entries, column=None):
        for t in entries or []:
            name = t if isinstance(t, str) else next(iter(t))
            yield f"{name}({column})" if column else name

    for f in sorted((platform / "models").rglob("*.yml")):
        doc = yaml.safe_load(f.read_text(encoding="utf-8")) or {}
        for m in doc.get("models") or []:
            tests[m["name"]] += names(m.get("data_tests") or m.get("tests"))
            for c in m.get("columns") or []:
                tests[m["name"]] += names(c.get("data_tests") or c.get("tests"), c["name"])
    for f in sorted((platform / "tests").rglob("*.sql")):
        for ref in set(re.findall(r"ref\(\s*['\"](\w+)['\"]\s*\)", f.read_text(encoding="utf-8"))):
            tests[ref].append(f.stem)
    return tests


def delivery_node(path: str, graph: dict) -> dict | None:
    """The most specific delivery pattern that matches the path."""
    hits = [n for n in graph["nodes"]
            if n["type"] == "delivery" and pattern_regex(n["label"]).match(path)]
    return max(hits, key=lambda n: len(n["label"].replace("*", "")), default=None)


def upstream(start: list[str], graph: dict) -> list[str]:
    """Every node a lineage edge leads back to from the start nodes."""
    back = defaultdict(list)
    for e in graph["edges"]:
        if e["type"] == "lineage":
            back[e["target"]].append(e["source"])
    seen: set[str] = set()
    todo = list(start)
    while todo:
        for s in back[todo.pop()]:
            if s not in seen:
                seen.add(s)
                todo.append(s)
    return sorted(seen)


def lineage(out: dict, graph: dict, tests: dict, checks: list[dict]) -> dict:
    """What a delivery pattern is written from: its publishers, the dbt models they read with
    their tests, and the raw tables and origins upstream of those models."""
    nodes = {n["id"]: n for n in graph["nodes"]}
    models = sorted({e["source"] for e in graph["edges"]
                     if e["type"] == "delivery" and e["target"] == out["id"]})
    above = upstream(models, graph)
    names = {nodes[m]["label"] for m in models if m in nodes}
    return {
        "published_by": [p["path"] for p in out.get("published_by", [])],
        "models": [{"name": nodes[m]["label"], "layer": nodes[m]["layer"],
                    "tests": len(tests.get(nodes[m]["label"], []))}
                   for m in models if m in nodes],
        "test_kinds": sorted({t.split("(")[0] for m in names for t in tests.get(m, [])}),
        "raw": [nodes[n]["label"] for n in above if n.startswith("raw:")],
        "origins": [{"label": nodes[n]["label"], "url": nodes[n].get("url")}
                    for n in above if n.startswith("src:")],
        "checks": [{"id": c["quality_check_id"], "status": c["status"],
                    "evaluated_at": c.get("evaluated_at")}
                   for c in checks
                   if names & set(re.findall(r"\w+\.(\w+)", c.get("dataset_id") or ""))],
    }


def build(paths: list[str], graph: dict, tests: dict, checks: list[dict]) -> dict:
    """`paths` maps each data path to its delivery pattern, or to null when the graph has none;
    `deliveries` holds each pattern's lineage once."""
    outs = {p: delivery_node(p, graph) for p in paths if p not in LIVE}
    live = {p: {"published_by": [LIVE[p]], "models": [], "test_kinds": [], "raw": [],
                "origins": [], "checks": []} for p in paths if p in LIVE}
    return {
        "graph_generated_at": graph.get("generated_at"),
        "paths": {p: (p if p in LIVE else outs[p] and outs[p]["label"]) for p in paths},
        "deliveries": {**{o["label"]: lineage(o, graph, tests, checks)
                          for o in outs.values() if o}, **live},
    }


def main() -> None:
    paths = post_sources()
    unknown = unknown_paths(paths)
    if unknown:
        sys.exit(f"feed posts declare unpublished paths: {unknown}")
    graph = json.loads(GRAPH.read_text(encoding="utf-8"))
    checks = json.loads(CHECKS.read_text(encoding="utf-8"))
    result = build(paths, graph, model_tests(), checks)
    with OUT.open("w", encoding="utf-8", newline="\n") as f:
        json.dump(result, f, ensure_ascii=False, separators=(",", ":"))
        f.write("\n")
    traced = sum(1 for v in result["paths"].values() if v)
    print(f"{OUT.relative_to(ROOT).as_posix()}: {traced} of {len(paths)} paths traced")


if __name__ == "__main__":
    main()
