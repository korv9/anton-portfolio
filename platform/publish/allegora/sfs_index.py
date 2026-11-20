"""Allegora's index of every Swedish law and ordinance in force, built as a Cloud Run job.

    python sfs_index.py --raw /data/raw/sfs --out /data/index [--limit N] [--chunks-only]

Reads raw/sfs as platform/ingest/sfs/ingest.py --all wrote it (catalogue.json, _manifest.jsonl,
texts/<dok_id>.text), keeps the documents whose title makes them a lag or förordning and whose
header has no "Upphävd:" date on or before the fetch date, and splits each with
platform/ingest/sfs/chunking.py: one passage per paragraph, per stycke of a long one, and for a
document without numbered paragraphs its body packed into pieces of at most 1,500 characters.
The kind rule is the one in platform/models/silver/sfs/int_sfs_documents.sql.

Writes to --out:
    passages.jsonl  {id, title, url, text, law, kind, fetched}, one per line, in vector order
    vectors.f16     n x DIMS float16, unit length, Vertex AI text embeddings (vertex.py)
    index.json      model, dims, n, counts per kind, the newest fetch date, when it was built
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote

import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.append(str(HERE))
sys.path.append(str(HERE.parents[1] / "ingest" / "sfs"))

from chunking import body, pack, paragraphs  # noqa: E402
import vertex  # noqa: E402

RIKSDAGEN = "https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling"
FUNDAMENTAL = ("tryckfrihetsförordning", "regeringsform", "riksdagsordning", "successionsordning")
REPEALED = re.compile(r"^Upphävd:\s*(\d{4}-\d{2}-\d{2})", re.M)
# A request holds at most 250 texts and 20,000 tokens; Swedish runs about 3 characters a token.
BATCH_TEXTS, BATCH_CHARS = 250, 40_000


def kind(title: str) -> str:
    """lag, förordning or other, from the title's first word as int_sfs_documents.sql reads it."""
    title = re.sub(r"\s+", " ", title).strip()
    word = re.match(r"([^\s(,]*)", re.sub(r"^(\s*/[^/]*/\s*)+", "", title)).group(1).lower()
    if word in FUNDAMENTAL or "om beslutad ny regeringsform" in title.lower():
        return "lag"
    if word.endswith("lag") or word.endswith("balk"):
        return "lag"
    return "förordning" if word.endswith("förordning") else "other"


def anchor(item: dict) -> str:
    """riksdagen.se's own anchors: K<chapter>P<paragraph>S<stycke>."""
    out = f"K{item['chapter'].replace(' ', '')}" if item["chapter"] else ""
    out += f"P{item['paragraph'].replace(' ', '')}"
    return out + (f"S{item['stycke']}" if item["stycke"] and item["stycke"] > 1 else "")


def document_passages(doc: dict, text: str, fetched: str) -> list[dict]:
    """The passages of one document in force, or none when it is repealed or only OCR'd XML."""
    head = text[:text.find("Källa:")] if "Källa:" in text else ""
    if (m := REPEALED.search(head)) and m.group(1) <= fetched or text.lstrip().startswith("<"):
        return []
    name = re.sub(r"\s+", " ", doc["titel"]).strip()
    page = f"{RIKSDAGEN}/_{quote(doc['dok_id'])}/"
    common = {"law": doc["beteckning"], "kind": kind(name), "fetched": fetched}
    items = paragraphs(text, sfs=doc["beteckning"], name=name, fetched=fetched)
    if items:
        return [{"id": item["id"], "title": item["title"], "url": page + "#" + anchor(item),
                 "text": item["text"], **common} for item in items]
    pieces = pack(body(text))
    return [{"id": f"{doc['dok_id']}-whole" + (f"-{n}" if len(pieces) > 1 else ""),
             "title": name, "url": page, "text": piece, **common}
            for n, piece in enumerate(pieces, 1)]


def chunk(raw: Path, limit: int | None = None) -> list[dict]:
    catalogue = json.loads((raw / "catalogue.json").read_text(encoding="utf-8"))
    fetched_at: dict[str, str] = {}
    for line in (raw / "_manifest.jsonl").read_text(encoding="utf-8").splitlines():
        entry = json.loads(line)
        if entry.get("method") == "GET":
            fetched_at[entry["path"]] = max(fetched_at.get(entry["path"], ""), entry["fetched_at"])
    rows, seen, skipped = [], set(), {"other": 0, "no text": 0, "failed": 0}
    for doc in catalogue:
        if kind(doc["titel"]) == "other":
            skipped["other"] += 1
            continue
        path = raw / "texts" / f"{doc['dok_id']}.text"
        if not path.exists():
            skipped["no text"] += 1
            continue
        fetched = fetched_at.get(f"texts/{doc['dok_id']}.text", "")[:10]
        try:
            found = document_passages(doc, path.read_text(encoding="utf-8"), fetched)
        except Exception as error:  # noqa: BLE001 - counted, as int_sfs_documents does
            print(f"{doc['dok_id']}: {error!r}", file=sys.stderr)
            skipped["failed"] += 1
            continue
        for row in found:
            # Two documents can share an SFS number; the second's ids take its dok_id.
            if row["id"] in seen:
                row["id"] = f"{doc['dok_id']}-{row['id']}"
            if row["id"] in seen or not row["text"].strip():
                continue
            seen.add(row["id"])
            rows.append(row)
        if limit and len(rows) >= limit:
            break
    print(f"{len(rows)} passages; skipped documents: {skipped}")
    return rows


def batches(rows: list[dict]) -> list[list[dict]]:
    out, size = [[]], 0
    for row in rows:
        length = len(row["title"]) + len(row["text"])
        if out[-1] and (len(out[-1]) == BATCH_TEXTS or size + length > BATCH_CHARS):
            out.append([])
            size = 0
        out[-1].append(row)
        size += length
    return out


def embed_all(rows: list[dict], workers: int) -> np.ndarray:
    groups = batches(rows)
    done = 0

    def one(group: list[dict]) -> np.ndarray:
        nonlocal done
        vectors = np.asarray(vertex.embed([r["text"] for r in group], "RETRIEVAL_DOCUMENT",
                                          [r["title"] for r in group]), dtype=np.float32)
        done += 1
        if done % 50 == 0:
            print(f"embedded {done}/{len(groups)} requests", flush=True)
        return vectors

    with ThreadPoolExecutor(workers) as pool:
        matrix = np.vstack(list(pool.map(one, groups)))
    matrix /= np.linalg.norm(matrix, axis=1, keepdims=True)
    return matrix.astype(np.float16)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--raw", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--limit", type=int, help="stop after about this many passages")
    parser.add_argument("--chunks-only", action="store_true", help="write passages.jsonl only")
    parser.add_argument("--workers", type=int, default=6)
    args = parser.parse_args()
    rows = chunk(args.raw, args.limit)
    args.out.mkdir(parents=True, exist_ok=True)
    with (args.out / "passages.jsonl").open("w", encoding="utf-8", newline="\n") as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")
    if args.chunks_only:
        return 0
    matrix = embed_all(rows, args.workers)
    (args.out / "vectors.f16").write_bytes(matrix.tobytes())
    counts = {k: sum(r["kind"] == k for r in rows) for k in ("lag", "förordning")}
    (args.out / "index.json").write_text(json.dumps({
        "model": vertex.MODEL, "dims": vertex.DIMS, "n": len(rows), "passages": counts,
        "documents": {k: len({r["law"] for r in rows if r["kind"] == k}) for k in counts},
        "fetched": max(r["fetched"] for r in rows),
        "created": datetime.now(timezone.utc).isoformat(timespec="seconds")}, indent=1),
        encoding="utf-8")
    print(f"wrote {len(rows)} x {vertex.DIMS} vectors to {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
