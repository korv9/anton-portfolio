"""The law corpora behind "Fråga lagen": passages to embed, then the files the browser and Worker read.

    python platform/publish/workers_ai/export_law_corpora.py chunks [--corpus sfs|ai-act]
    python platform/publish/workers_ai/export_law_corpora.py meta --corpus sfs --run <embed run> --recall 0.93

`chunks` writes warehouse/features/workers_ai/<corpus>/chunks.jsonl, one passage per line with
{id, title, url, text, embed} where `embed` (title and text) is what platform/nlp/workers_ai.py
embeds and `text` is what a quote is checked against:

    sfs         one row of int_sfs_paragraphs per passage (paragraph, or stycke of a long one)
    ai-act-sv   the AI Act in Swedish and English, from the published article and annex texts
    ai-act-en   (frontend/public/data/ai-act/article-text-<lang>.json), split per paragraph
                and point (art_5-1-a, anx_III-1-a), plus the 180 recitals (rct_<n>) parsed from
                the Official Journal text in warehouse/raw/eu_ai_act/acts/32024R1689.<lang>.xhtml

`meta` writes frontend/public/data/workers-ai/<corpus>/meta.json in the order of the embed run's
ids.json (vectors.bin and pca.json come from `workers_ai.py compress`, which also reports the
recall@10 passed as --recall; for sfs also the fetch date and the list of laws), and the Worker's
verification lists verify/<xx>.json: {id: text_hash(text)} sharded by the first two hex
characters of sha256(id), so the Worker parses a few KB per request.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "platform"))

from legal.parse import parse_act, text_hash  # noqa: E402

FEATURES = ROOT / "warehouse" / "features" / "workers_ai"
SITE = ROOT / "frontend" / "public" / "data" / "workers-ai"
AI_ACT = ROOT / "frontend" / "public" / "data" / "ai-act"
RAW = Path(os.environ.get("PORTFOLIO_RAW", ROOT / "warehouse" / "raw"))
DATABASE = Path(os.environ.get("PORTFOLIO_DB", ROOT / "warehouse" / "portfolio.duckdb"))
OJ = "32024R1689"
RIKSDAGEN = "https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling"
ROMAN = {"i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x", "xi", "xii"}
PARAGRAPH = {"en": re.compile(r"^(?:(\d+[a-z]?)\.|\((\d+[a-z]?)\)) "),
             "sv": re.compile(r"^(\d+[a-z]?)\. ()")}
# Annex XIV writes its points "a. " in English and "a) " in Swedish.
POINT = {"en": re.compile(r"^(?:\(([a-z]{1,4})\)|([a-z])\.) "),
         "sv": re.compile(r"^([a-z]{1,4})\) ()")}
WORDS = {"en": {"art": "Article", "anx": "Annex", "rct": "Recital", "point": "point"},
         "sv": {"art": "Artikel", "anx": "Bilaga", "rct": "Skäl", "point": "punkt"}}


def follows(letter: str, previous: str | None) -> bool:
    """Whether a point letter continues the list: a after nothing, c after b or ba, ba after b."""
    if previous is None:
        return letter == "a"
    after = chr(ord(previous[0]) + 1)
    inserted = previous + "a" if len(previous) == 1 else previous[0] + chr(ord(previous[1]) + 1)
    return letter in (after, inserted)


def split_provision(provision: str, text: str, lang: str) -> list[tuple[str, str]]:
    """(id, text) per paragraph and point of an article or annex, in reading order.

    Lines are blocks ("1. ...", "(a) ...", "(i) ..."). A roman sub-point stays with its point;
    "(i)" is the ninth point only right after an "(h)" that does not open a list. A line without a marker belongs to the
    paragraph (or to the provision itself when it has no numbered paragraphs)."""
    units: dict[str, list[str]] = {}
    paragraph = point = None
    for line in text.split("\n"):
        number = PARAGRAPH[lang].match(line)
        match = POINT[lang].match(line)
        letter = match and (match.group(1) or match.group(2))
        if number:
            paragraph, point = number.group(1) or number.group(2), None
            units.setdefault(f"{provision}-{paragraph}", []).append(line)
        elif letter and (letter not in ROMAN or follows(letter, point) and not (
                units[f"{provision}-{paragraph}-{point}" if paragraph else
                      f"{provision}-{point}"][-1].endswith(":"))):
            point = letter
            parent = f"{provision}-{paragraph}" if paragraph else provision
            units.setdefault(f"{parent}-{point}", []).append(line)
        elif letter and point:
            units[f"{f'{provision}-{paragraph}' if paragraph else provision}-{point}"].append(line)
        else:
            units.setdefault(f"{provision}-{paragraph}" if paragraph else provision, []).append(line)
    return [(ident, "\n".join(lines)) for ident, lines in units.items()]


def title(ident: str, lang: str, heading: str) -> str:
    """art_5-1-a -> "Article 5(1)(a)" / "Artikel 5.1 a", with the article's heading."""
    kind, _, rest = ident.partition("_")
    parts = rest.split("-")
    words = WORDS[lang]
    if lang == "en":
        label = f"{words[kind]} {parts[0]}" + "".join(f"({p})" for p in parts[1:])
    else:
        label = f"{words[kind]} {parts[0]}" + (f".{parts[1]}" if len(parts) > 1 else "")
        label += "".join(f" {p}" for p in parts[2:])
    if kind == "anx" and len(parts) > 1:
        label = f"{words['anx']} {parts[0]}, {words['point']} {parts[1]}" + "".join(
            f"({p})" if lang == "en" else f" {p}" for p in parts[2:])
    return f"{label}, {heading}" if heading else label


def ai_act_chunks(lang: str) -> list[dict]:
    texts = json.loads((AI_ACT / f"article-text-{lang}.json").read_text(encoding="utf-8"))
    articles = {a["article_id"]: a for a in json.loads(
        (AI_ACT / "articles.json").read_text(encoding="utf-8"))}
    base = next(iter(articles.values()))["source_url"].split("#")[0].replace(
        "/EN/", f"/{lang.upper()}/")
    rows = []
    for provision, text in texts.items():
        heading = (articles.get(provision) or {}).get(f"title_{lang}", "").strip("'")
        for ident, part in split_provision(provision, text, lang):
            rows.append({"id": ident, "title": title(ident, lang, heading),
                         "url": f"{base}#{provision}", "text": part, "lang": lang})
    act = parse_act((RAW / "eu_ai_act" / "acts" / f"{OJ}.{lang}.xhtml").read_bytes())
    oj = f"https://eur-lex.europa.eu/legal-content/{lang.upper()}/TXT/HTML/?uri=CELEX:{OJ}"
    for recital in (p for p in act.provisions if p.kind == "recital"):
        rows.append({"id": recital.provision_id, "url": f"{oj}#{recital.provision_id}",
                     "title": title(recital.provision_id, lang, ""), "text": recital.text,
                     "lang": lang})
    return rows


def sfs_chunks() -> list[dict]:
    import duckdb

    with duckdb.connect(str(DATABASE), read_only=True) as db:
        frame = db.sql("select id, title, url, text, sfs as law, fetched "
                       "from silver.int_sfs_paragraphs order by sfs, id").df()
    frame["fetched"] = frame["fetched"].astype(str)
    return frame.to_dict("records")


def write_chunks(corpus: str, rows: list[dict]) -> None:
    ids = [r["id"] for r in rows]
    if len(ids) != len(set(ids)) or any(not r["text"].strip() for r in rows):
        raise ValueError(f"{corpus}: duplicate ids or empty passages")
    out = FEATURES / corpus / "chunks.jsonl"
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", encoding="utf-8", newline="\n") as handle:
        for row in rows:
            handle.write(json.dumps({**row, "embed": f"{row['title']}\n{row['text']}"},
                                    ensure_ascii=False) + "\n")
    print(f"{corpus}: {len(rows)} passages, {sum(len(r['text']) for r in rows):,} characters "
          f"-> {out.relative_to(ROOT)}")


def laws() -> list[dict]:
    """The selected laws as the page lists them, from the selection the ingest kept."""
    selection = json.loads((RAW / "sfs" / "selection.json").read_text(encoding="utf-8"))
    return [{"sfs": law["sfs"], "title": law["name"], "url": f"{RIKSDAGEN}/_{law['dok_id']}/"}
            for law in selection]


def meta(corpus: str, run: Path, recall: float | None) -> None:
    chunks = {}
    for line in (FEATURES / corpus / "chunks.jsonl").read_text(encoding="utf-8").splitlines():
        row = json.loads(line)
        row.pop("embed")
        chunks[row["id"]] = row
    ids = json.loads((run / "ids.json").read_text(encoding="utf-8"))
    out = SITE / corpus
    pca = json.loads((out / "pca.json").read_text(encoding="utf-8"))
    if (out / "vectors.bin").stat().st_size != len(ids) * pca["dims"]:
        raise ValueError(f"{corpus}: vectors.bin does not hold {len(ids)} x {pca['dims']} codes")
    items = [chunks[i] for i in ids]
    document = {"corpus": corpus, "model": pca["model"],
                "created": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                "n": len(items), "dims": pca["dims"],
                "recall_at_10": recall}
    if corpus == "sfs":
        document |= {"fetched": max(item["fetched"] for item in items), "laws": laws()}
    document["items"] = items
    (out / "meta.json").write_text(json.dumps(document, ensure_ascii=False, separators=(",", ":")),
                                   encoding="utf-8")
    shards: dict[str, dict] = {}
    for item in items:
        shard = hashlib.sha256(item["id"].encode("utf-8")).hexdigest()[:2]
        shards.setdefault(shard, {})[item["id"]] = text_hash(item["text"])
    (out / "verify").mkdir(exist_ok=True)
    for stale in (out / "verify").glob("*.json"):
        stale.unlink()
    for shard, entries in shards.items():
        (out / "verify" / f"{shard}.json").write_text(
            json.dumps(dict(sorted(entries.items())), separators=(",", ":")), encoding="utf-8")
    print(f"{corpus}: meta.json {len(items)} items, {len(shards)} verification shards")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("command", choices=["chunks", "meta"])
    parser.add_argument("--corpus", choices=["sfs", "ai-act", "ai-act-sv", "ai-act-en"])
    parser.add_argument("--run", type=Path, help="meta: the finished embed run folder")
    parser.add_argument("--recall", type=float, help="meta: recall@10 that compress reported")
    args = parser.parse_args()
    if args.command == "meta":
        if not (args.corpus and args.corpus != "ai-act" and args.run):
            parser.error("meta needs --corpus sfs|ai-act-sv|ai-act-en and --run")
        meta(args.corpus, args.run, args.recall)
        return 0
    if args.corpus in (None, "sfs"):
        write_chunks("sfs", sfs_chunks())
    if args.corpus in (None, "ai-act", "ai-act-sv", "ai-act-en"):
        for lang in ("sv", "en"):
            if args.corpus in (None, "ai-act", f"ai-act-{lang}"):
                write_chunks(f"ai-act-{lang}", ai_act_chunks(lang))
    return 0


if __name__ == "__main__":
    sys.exit(main())
