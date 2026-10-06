"""Check the Symbolic Atlas corpus before it is analysed.

    python platform/ingest/symbolic/audit_corpus.py

Run after ingest_corpus.py. For every document in corpus.json it checks that the metadata is
complete and the ids unique, that the fetched Gutenberg file's own header names the same title
and English as its language, and how long the text is. Then it looks for the same text twice:
two editions of one work, or an anthology that reprints another book. Each body (between
Gutenberg's START and END lines) is cut into overlapping eight-word shingles; for every pair of
documents the share of the smaller one's shingles found in the larger is its containment. A
pair above DUPLICATE is reported as a duplicate, one above OVERLAP as an overlap to look at.

Writes platform/ingest/symbolic/corpus_audit.json and exits 1 when a check fails (a missing
field, a title mismatch, a text under MIN_WORDS words or a duplicate), so a bad corpus stops the
build rather than skewing the atlas.
"""
from __future__ import annotations

import json
import re
import sys
import unicodedata
from datetime import datetime, timezone
from hashlib import blake2b
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
RAW = ROOT / "warehouse" / "raw" / "symbolic" / "gutenberg"
OUT = HERE / "corpus_audit.json"

REQUIRED = ["id", "gutenberg_id", "title", "author", "tradition", "culture", "region", "genre",
            "source_type", "period", "language", "rights"]
SOURCE_TYPES = {"translation", "retelling", "folklore-collection", "literary", "primary-english"}
PERIODS = {"ancient", "medieval", "early-modern", "19th-century", "modern"}
MIN_WORDS = 5_000
SHINGLE = 8
# Shingles kept per text: a hash sample, so pairs compare in memory for a hundred books.
KEEP_BELOW = 2 ** 64 // 8
DUPLICATE = 0.30
OVERLAP = 0.05

START = re.compile(r"\*\*\* ?START OF (THE|THIS) PROJECT GUTENBERG EBOOK[^\n]*\n", re.I)
END = re.compile(r"\*\*\* ?END OF (THE|THIS) PROJECT GUTENBERG EBOOK", re.I)


def fold(text: str) -> str:
    text = unicodedata.normalize("NFKD", text)
    return re.sub(r"[^a-z0-9 ]+", " ", text.encode("ascii", "ignore").decode().lower())


def header(text: str, field: str) -> str | None:
    match = re.search(rf"^{field}:\s*(.+(?:\n {{2,}}.+)*)", text[:6000], re.M)
    return " ".join(match.group(1).split()) if match else None


def body(text: str) -> str:
    start = START.search(text)
    end = END.search(text)
    return text[start.end() if start else 0: end.start() if end else len(text)]


def shingles(text: str) -> set[int]:
    words = fold(text).split()
    out = set()
    for i in range(len(words) - SHINGLE + 1):
        h = int.from_bytes(blake2b(" ".join(words[i:i + SHINGLE]).encode(), digest_size=8).digest(), "big")
        if h < KEEP_BELOW:
            out.add(h)
    return out


def same_title(corpus_title: str, file_title: str | None) -> bool:
    if not file_title:
        return False
    a, b = fold(corpus_title).split(), fold(file_title).split()
    n = min(len(a), len(b), 6)
    return a[:n] == b[:n]


def main() -> int:
    corpus = json.loads((HERE / "corpus.json").read_text(encoding="utf-8"))["documents"]
    problems: list[str] = []
    ids = [d["id"] for d in corpus]
    gids = [d["gutenberg_id"] for d in corpus]
    for label, values in (("id", ids), ("gutenberg_id", gids)):
        dupes = sorted({str(v) for v in values if values.count(v) > 1})
        if dupes:
            problems.append(f"repeated {label}: {', '.join(dupes)}")

    documents, prints = [], {}
    for d in corpus:
        missing = [k for k in REQUIRED if not d.get(k)]
        if missing:
            problems.append(f"{d['id']}: missing {', '.join(missing)}")
        if d.get("source_type") not in SOURCE_TYPES:
            problems.append(f"{d['id']}: unknown source_type {d.get('source_type')}")
        if d.get("period") not in PERIODS:
            problems.append(f"{d['id']}: unknown period {d.get('period')}")
        path = RAW / f"{d['id']}.txt"
        if not path.exists():
            problems.append(f"{d['id']}: text not fetched")
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        file_title, language = header(text, "Title"), header(text, "Language")
        words = len(body(text).split())
        entry = {"id": d["id"], "gutenberg_id": d["gutenberg_id"], "file_title": file_title,
                 "file_language": language, "words": words,
                 "title_matches": same_title(d["title"], file_title)}
        if not entry["title_matches"]:
            problems.append(f"{d['id']}: file title {file_title!r} does not match {d['title']!r}")
        if language != "English":
            problems.append(f"{d['id']}: file language {language!r}")
        if words < MIN_WORDS:
            problems.append(f"{d['id']}: only {words} words")
        documents.append(entry)
        prints[d["id"]] = shingles(body(text))

    pairs = []
    names = sorted(prints)
    for i, a in enumerate(names):
        for b in names[i + 1:]:
            small, large = (a, b) if len(prints[a]) <= len(prints[b]) else (b, a)
            if not prints[small]:
                continue
            containment = len(prints[small] & prints[large]) / len(prints[small])
            if containment >= OVERLAP:
                pairs.append({"contained": small, "in": large, "containment": round(containment, 3),
                              "verdict": "duplicate" if containment >= DUPLICATE else "overlap"})
    pairs.sort(key=lambda p: -p["containment"])
    for p in pairs:
        if p["verdict"] == "duplicate":
            problems.append(f"duplicate text: {p['contained']} is {p['containment']:.0%} contained in {p['in']}")

    OUT.write_text(json.dumps({
        "audited_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "documents_listed": len(corpus), "documents_checked": len(documents),
        "thresholds": {"min_words": MIN_WORDS, "shingle_words": SHINGLE,
                       "duplicate": DUPLICATE, "overlap": OVERLAP},
        "problems": problems, "text_pairs": pairs, "documents": documents,
    }, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{len(documents)} of {len(corpus)} documents checked; {len(pairs)} overlapping pairs; "
          f"{len(problems)} problems")
    for p in problems:
        print("  ", p)
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
