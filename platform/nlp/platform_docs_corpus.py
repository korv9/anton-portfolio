"""The corpus behind "Ask the platform": the repository's own public documents as passages.

    python platform/nlp/platform_docs_corpus.py --manifest tmp/dbt-parse/manifest.json

Writes warehouse/features/workers_ai/platform/chunks.jsonl in the shape that
platform/publish/workers_ai/export_law_corpora.py reads, one passage per line with
{id, title, url, text, path, commit, nodes, embed}. The passages come from four places, all read
from Git at HEAD so a passage is the text of the commit it names:

    docs        tracked docs/**/*.md and README.md, split at headings and packed to 1,500 characters
    dbt         each model in the dbt manifest (from `dbt parse`): description, columns, contract
                and tests, attributed to the tracked schema file that declares them
    graph       sources, fetch scripts and published files in frontend/public/data/architecture/graph.json
    catalog     one passage per product in frontend/public/data/catalog.json

`path` is the tracked file a passage comes from, `commit` the last commit that changed it, and
`nodes` the graph node ids (frontend/public/data/architecture/graph.json) the passage names.
A path that Git does not track, that .gitignore covers, or that looks private is refused.
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from collections import defaultdict
from functools import cache
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "platform" / "ingest" / "sfs"))
from chunking import pack  # noqa: E402

OUT = ROOT / "warehouse" / "features" / "workers_ai" / "platform" / "chunks.jsonl"
GRAPH = "frontend/public/data/architecture/graph.json"
CATALOG = "frontend/public/data/catalog.json"
REPO = "https://github.com/korv9/anton-portfolio/blob"
LONG = 1500
PRIVATE = re.compile(r"(^|/)(\.env|private|warehouse|\.idea-lineage|profiles?)(/|$|\.)", re.I)
HEADING = re.compile(r"^(#{1,4}) +(.+?)\s*#*\s*$")
TICKED = re.compile(r"`([^`\s]+)`")
# Operator logs: audits and run records written on one machine, with its local paths.
EXCLUDED = {"docs/compliance-intelligence/repository-audit.md", "docs/compliance-intelligence/validation.md"}
LOCAL = re.compile(r"\b[A-Za-z]:[/\\]Users[/\\]|/home/\w+/|/Users/\w+/")
# English names for the documents written in Swedish, put in front of the text that is embedded
# (not into the passage), so that an English question finds them.
ALIAS = {
    "docs/chart-review.md": "Chart and KPI view review: open findings and chart choices",
    "docs/data-dictionary.md": "Data dictionary: tables, columns, relations and sources",
    "docs/delivery-validation.md": "Semantic validation before data delivery",
    "docs/mockups/SPEC.md": "Dashboard specification per project",
    "docs/public-clustering-experiments.md": "Clustering of party leader debates and county profiles",
    "docs/public-clustering-method.md": "Method and rerun for the public clustering experiments",
    "docs/r2-delivery-contract.md": "Versioned data delivery from R2",
    "docs/thesis-evidence-review.md": "Review of the thesis portfolio content",
    "docs/welfare-data-model.md": "Welfare data model: how Sweden is doing",
    "docs/workers-ai.md": "Workers AI: Ask the law and Ask the platform, model choice, embeddings, eval and quota",
}


def git(*args: str) -> str:
    return subprocess.run(["git", *args], cwd=ROOT, check=True, capture_output=True,
                          text=True, encoding="utf-8").stdout


@cache
def ignored(path: str) -> bool:
    return subprocess.run(["git", "check-ignore", "-q", "--no-index", path], cwd=ROOT).returncode == 0


def allowed(path: str, tracked: set[str]) -> bool:
    """A path may enter the corpus only when Git tracks it, no ignore rule covers it, and it is not private."""
    return path in tracked and not PRIVATE.search(path) and not ignored(path)


class Files:
    """Tracked files at HEAD with the last commit that changed each one."""

    def __init__(self) -> None:
        self.tracked = set(git("ls-files", "-z").split("\0")) - {""}
        dirty = git("status", "--porcelain")
        self.dirty = {line[3:].strip() for line in dirty.splitlines()}
        self.commits: dict[str, str] = {}

    def read(self, path: str) -> str:
        if not allowed(path, self.tracked):
            raise ValueError(f"{path}: not a tracked public file")
        return git("show", f"HEAD:{path}")

    def commit(self, path: str) -> str:
        if path not in self.commits:
            if path in self.dirty:
                raise ValueError(f"{path}: has uncommitted changes; commit them before building")
            self.commits[path] = git("log", "-1", "--format=%H", "--", path).strip()
        return self.commits[path]


def slug(heading: str) -> str:
    return re.sub(r"[^\w]+", "-", heading.lower()).strip("-") or "section"


def sections(text: str) -> list[tuple[str, str, str]]:
    """(heading, body, heading path "H1 > H2") per heading of a Markdown text; code fences are
    not read as headings."""
    out, heading, lines, fenced, trail = [], "", [], False, {}
    for line in text.splitlines():
        if line.lstrip().startswith("```"):
            fenced = not fenced
        match = None if fenced else HEADING.match(line)
        if match:
            out.append((heading, "\n".join(lines), " > ".join(trail.values())))
            level, heading, lines = len(match.group(1)), match.group(2).strip(), []
            trail = {k: v for k, v in trail.items() if k < level} | {level: heading}
        else:
            lines.append(line)
    out.append((heading, "\n".join(lines), " > ".join(trail.values())))
    return [(h, b.strip(), t) for h, b, t in out if b.strip()]


class Graph:
    def __init__(self, files: Files) -> None:
        graph = json.loads(files.read(GRAPH))
        self.nodes = {n["id"]: n for n in graph["nodes"]}
        self.edges = graph["edges"]
        # A backticked name in a document points at a node when it is a model name or a node's path.
        self.names = {}
        for node in graph["nodes"]:
            if node["id"].startswith("dbt:"):
                self.names[node["label"]] = node["id"]
            if node.get("path"):
                self.names[node["path"]] = node["id"]

    def named(self, text: str) -> list[str]:
        found = [self.names[t] for t in TICKED.findall(text) if t in self.names]
        return list(dict.fromkeys(found))[:6]


def row(ident: str, title: str, path: str, text: str, files: Files, nodes: list[str],
        context: str = "") -> dict:
    """`embed` is the text that is embedded: context (default the title) and the passage."""
    commit = files.commit(path)
    return {"id": ident, "title": title, "url": f"{REPO}/{commit}/{path}", "text": text,
            "path": path, "commit": commit, "nodes": nodes, "embed": f"{context or title}\n{text}"}


def doc_rows(files: Files, graph: Graph) -> list[dict]:
    paths = sorted(p for p in files.tracked
                   if (p == "README.md" or p.startswith("docs/") and p.endswith(".md"))
                   and p not in EXCLUDED)
    rows, seen = [], defaultdict(int)
    for path in paths:
        name = f"{path} ({ALIAS[path]})" if path in ALIAS else path
        for heading, body, trail in sections(files.read(path)):
            base = f"{path}#{slug(heading)}" if heading else path
            # A block over the limit (a long table or list) is split into its lines first.
            blocks = [line for b in re.split(r"\n\s*\n", body) if b.strip()
                      for line in ([b.strip()] if len(b.strip()) <= LONG else b.strip().splitlines())]
            for piece in pack([b for b in blocks if b.strip()], LONG):
                if LOCAL.search(piece):
                    continue
                seen[base] += 1
                ident = base if seen[base] == 1 else f"{base}-{seen[base]}"
                title = f"{path} › {heading}" if heading else path
                rows.append(row(ident, title, path, piece, files, graph.named(piece),
                                f"{name} › {trail}" if trail else name))
    return rows


def tests_by_model(manifest: dict) -> dict[str, list[str]]:
    out = defaultdict(list)
    for test in manifest["nodes"].values():
        if test["resource_type"] != "test":
            continue
        meta = test.get("test_metadata") or {}
        column = test.get("column_name")
        label = (f"{meta['name']}" + (f" on {column}" if column else "")) if meta else test["name"]
        kwargs = meta.get("kwargs", {}) if meta else {}
        if "columns" in kwargs:
            label += f" of {', '.join(kwargs['columns'])}"
        if "values" in kwargs:
            label += f" ({', '.join(map(str, kwargs['values']))})"
        if "to" in kwargs:
            label += f" to {kwargs['to'].removeprefix('ref(').strip(chr(39) + ')')}.{kwargs.get('field')}"
        if "min" in kwargs or "max" in kwargs:
            label += f" from {kwargs.get('min')} to {kwargs.get('max')}"
        for model in test["depends_on"]["nodes"]:
            if model.startswith("model."):
                out[model].append(label)
    return out


def model_rows(manifest: dict, files: Files, graph: Graph) -> list[dict]:
    tests = tests_by_model(manifest)
    rows = []
    for model in sorted((n for n in manifest["nodes"].values() if n["resource_type"] == "model"),
                        key=lambda n: n["name"]):
        sql = "platform/" + model["original_file_path"].replace("\\", "/")
        schema = (model.get("patch_path") or "").split("://")[-1].replace("\\", "/")
        path = f"platform/{schema}" if schema else sql
        columns = [f"- {c['name']}: {' '.join(c['description'].split())}" if c["description"].strip()
                   else f"- {c['name']}" for c in model["columns"].values()]
        if not (model["description"] or columns or tests[model["unique_id"]]):
            continue
        layer = sql.split("/")[2]
        config = model["config"]
        head = [f"Model {model['name']}, {layer} layer, materialized as {config['materialized']}, "
                f"defined in {sql}."]
        if model["description"]:
            head.append(model["description"].strip())
        if config.get("contract", {}).get("enforced"):
            head.append("The contract is enforced: dbt checks the column names and types at build time.")
        found = sorted(set(tests[model["unique_id"]]))
        blocks = ["\n".join(head)]
        if columns:
            blocks.append("Columns:\n" + "\n".join(columns))
        if found:
            blocks.append("Tests: " + "; ".join(found) + ".")
        node = f"dbt:{model['name']}"
        nodes = [node] if node in graph.nodes else []
        for n, piece in enumerate(pack(blocks, LONG - 100), 1):
            ident = node if n == 1 else f"{node}-{n}"
            if n > 1:
                # A continuation names its model, so a question about the model's tests finds it.
                piece = f"Model {model['name']}, continued: columns and tests.\n{piece}"
            rows.append(row(ident, f"{model['name']} ({path})", path, piece, files, nodes))
    return rows


def graph_rows(files: Files, graph: Graph) -> list[dict]:
    rows = []
    for node in graph.nodes.values():
        if node["type"] not in ("source", "ingestion", "delivery") or not node.get("description"):
            continue
        after = [graph.nodes[e["target"]]["label"] for e in graph.edges
                 if e["source"] == node["id"] and e["type"] == "lineage" and e["target"] in graph.nodes]
        before = [graph.nodes[e["source"]]["label"] for e in graph.edges
                  if e["target"] == node["id"] and e["type"] == "lineage" and e["source"] in graph.nodes]
        lines = [f"{node['label']} ({node['type']}): {node['description']}"]
        if node.get("url"):
            lines.append(f"Address: {node['url']}")
        if node.get("path"):
            lines.append(f"Path: {node['path']}")
        if before:
            lines.append("Comes from: " + ", ".join(sorted(set(before))) + ".")
        if after:
            lines.append("Feeds: " + ", ".join(sorted(set(after))) + ".")
        text = "\n".join(lines)[:LONG]
        rows.append(row(f"graph:{node['id']}", f"{node['label']} ({GRAPH})", GRAPH, text, files,
                        [node["id"]]))
    return rows


def catalog_rows(files: Files, graph: Graph) -> list[dict]:
    products = defaultdict(list)
    for entry in json.loads(files.read(CATALOG))["files"]:
        products[entry["product"]].append(entry)
    # The product's folder node in the graph; a glob node ("ai-act/*.json") wins over a single file.
    delivery = {}
    for n in sorted(graph.nodes.values(), key=lambda n: ("*" not in n.get("path", ""), n["id"]), reverse=True):
        if n["type"] == "delivery" and n.get("path", "").startswith("frontend/public/data/")                 and n["path"].count("/") > 3:
            delivery[n["path"].split("/")[3]] = n["id"]
    rows = []
    for product, entries in sorted(products.items()):
        formats = sorted({e["format"] for e in entries})
        size = sum(e.get("bytes") or 0 for e in entries)
        counted = [e["rows"] for e in entries if e.get("rows") is not None]
        examples = ", ".join(e["path"] for e in entries[:3])
        text = (f"The data product {product} publishes {len(entries)} files ({', '.join(formats)}), "
                f"{size:,} bytes in all" + (f" and {sum(counted):,} rows in the files that count rows"
                                            if counted else "")
                + f". The catalogue records a SHA-256 checksum for each file. Examples: {examples}.")
        nodes = [delivery[product]] if product in delivery else []
        rows.append(row(f"catalog:{product}", f"{product} ({CATALOG})", CATALOG, text, files, nodes))
    return rows


def build(manifest_path: Path) -> list[dict]:
    files = Files()
    graph = Graph(files)
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    rows = (doc_rows(files, graph) + model_rows(manifest, files, graph)
            + graph_rows(files, graph) + catalog_rows(files, graph))
    for r in rows:
        if not allowed(r["path"], files.tracked):
            raise ValueError(f"{r['path']}: not a tracked public file")
    ids = [r["id"] for r in rows]
    if len(ids) != len(set(ids)) or any(len(r["text"]) > LONG or not r["text"].strip() for r in rows):
        raise ValueError("duplicate ids, empty passages or passages over 1,500 characters")
    return rows


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--manifest", type=Path, required=True, help="target/manifest.json from `dbt parse`")
    args = parser.parse_args()
    rows = build(args.manifest)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", encoding="utf-8", newline="\n") as handle:
        for r in rows:
            handle.write(json.dumps(r, ensure_ascii=False) + "\n")
    kinds = defaultdict(int)
    for r in rows:
        kinds[r["id"].split(":")[0] if r["id"].split(":")[0] in ("dbt", "graph", "catalog") else "docs"] += 1
    print(f"{len(rows)} passages {dict(kinds)}, {sum(len(r['text']) for r in rows):,} characters "
          f"-> {OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
