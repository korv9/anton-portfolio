"""Count the AI Act's own terms per month in Riksdag speeches and in job ads, never pooled.

    python -m ml.ai_act.diffusion speeches                 # local: warehouse/raw/riksdagen/speeches
    python -m ml.ai_act.diffusion ads                      # every JobTech archive from 2020 (Actions)
    python -m ml.ai_act.diffusion ads --archives 2025 --sample 20000   # a quick local check

The terms are the kept rows of platform/seeds/cross_domain/ai_act_terms.csv, Swedish and English,
matched as docs/ai-act-diffusion-preregistration.md fixes. A document is one speech (its full
text) or one ad (headline and description, duplicate ad ids counted once). Nothing but counts is
kept. Under $PORTFOLIO_FEATURES/ai_act/diffusion/, per source (speeches, or ads_<archive>):

    <source>_months.parquet   documents per month (the denominator)
    <source>_terms.parquet    documents matching each term per month
    <source>.json             first and last document date, documents, the source's SHA-256 and
                              the term list's SHA-256; an unchanged source is not counted again

Dates after the day of the scan (a few ads say 2051) are left out.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import re
import sys
import zipfile
from collections import Counter
from datetime import date, datetime, timezone
from pathlib import Path

import pyarrow as pa
import pyarrow.parquet as pq

ROOT = Path(__file__).resolve().parents[2]
SEED = ROOT / "platform/seeds/cross_domain/ai_act_terms.csv"
SPEECHES = ROOT / "warehouse/raw/riksdagen/speeches"
OUT = Path(os.environ.get("PORTFOLIO_FEATURES", ROOT / "warehouse/features")) / "ai_act/diffusion"


def pattern(term: str) -> str:
    """Tokens in order, white space or a hyphen between them, up to four letters of inflection."""
    body = r"[\s-]+".join(re.escape(t) for t in term.split())
    return rf"(?<![\w-]){body}[a-zåäö]{{0,4}}(?!\w)"


def load_terms(path: Path = SEED) -> tuple[list[tuple[str, re.Pattern]], str]:
    raw = path.read_bytes().replace(b"\r\n", b"\n")
    terms = []
    for r in csv.DictReader(raw.decode("utf-8").splitlines()):
        if r["decision"] != "keep":
            continue
        terms.append((f"{r['term_id']}:sv", re.compile(pattern(r["term_sv"]), re.I)))
        if r["term_en"] and r["en_decision"] == "keep":
            terms.append((f"{r['term_id']}:en", re.compile(pattern(r["term_en"]), re.I)))
    return terms, hashlib.sha256(raw).hexdigest()


class Counts:
    """Documents and term matches per month for one source."""

    def __init__(self, terms: list[tuple[str, re.Pattern]]):
        self.terms = terms
        self.any = re.compile("|".join(p.pattern for _, p in terms), re.I)
        self.months: Counter = Counter()
        self.hits: Counter = Counter()
        self.dates: list[str] = []
        self.today = date.today().isoformat()

    def add(self, day: str, text: str) -> None:
        if not day or day > self.today:
            return
        month = day[:7]
        self.months[month] += 1
        self.dates = [min(self.dates[0], day), max(self.dates[1], day)] if self.dates else [day, day]
        if self.any.search(text):
            for term_id, p in self.terms:
                if p.search(text):
                    self.hits[(month, term_id)] += 1

    def write(self, folder: Path, source: str, extra: dict) -> None:
        folder.mkdir(parents=True, exist_ok=True)
        pq.write_table(pa.Table.from_pylist(
            [{"month": m, "documents": n} for m, n in sorted(self.months.items())],
            schema=pa.schema([("month", pa.string()), ("documents", pa.int64())])),
            folder / f"{source}_months.parquet")
        pq.write_table(pa.Table.from_pylist(
            [{"month": m, "term_key": t, "documents": n} for (m, t), n in sorted(self.hits.items())],
            schema=pa.schema([("month", pa.string()), ("term_key", pa.string()), ("documents", pa.int64())])),
            folder / f"{source}_terms.parquet")
        (folder / f"{source}.json").write_text(json.dumps({
            "source": source, "first_date": self.dates[0] if self.dates else None,
            "last_date": self.dates[1] if self.dates else None,
            "documents": sum(self.months.values()), **extra,
            "counted_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        }, indent=2) + "\n", encoding="utf-8", newline="\n")


def unchanged(folder: Path, source: str, stamp: dict) -> bool:
    path = folder / f"{source}.json"
    previous = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    return bool(previous) and all(previous.get(k) == v for k, v in stamp.items())


def speeches(terms, dictionary: str, force: bool) -> None:
    sys.path.insert(0, str(ROOT / "platform/nlp/text"))
    from concepts import paragraphs

    archives = sorted(SPEECHES.glob("anforande-*.json.zip"))
    if not archives:
        sys.exit(f"No speech archives in {SPEECHES}; pull them with "
                 "warehouse_store.py pull --only raw --path riksdagen/speeches")
    digest = hashlib.sha256("".join(sha256(p) for p in archives).encode()).hexdigest()
    stamp = {"sha256": digest, "dictionary_sha256": dictionary}
    if not force and unchanged(OUT, "speeches", stamp):
        print("speeches: unchanged archives and terms, skipped")
        return
    counts, seen = Counts(terms), set()
    for path in archives:
        with zipfile.ZipFile(path) as z:
            for name in z.namelist():
                if not name.endswith(".json"):
                    continue
                s = json.loads(z.read(name).decode("utf-8-sig"))["anforande"]
                key = f"{s['dok_id']}-{s['anforande_nummer']}"
                if key in seen:
                    continue
                seen.add(key)
                counts.add((s.get("dok_datum") or "")[:10], "\n".join(paragraphs(s.get("anforandetext") or "")))
    counts.write(OUT, "speeches", {**stamp, "archives": [p.name for p in archives]})
    print(f"speeches: {len(seen):,} speeches, {sum(counts.hits.values()):,} term matches")


def ads(terms, dictionary: str, names: list[str] | None, sample: int | None, force: bool) -> None:
    sys.path.insert(0, str(ROOT / "platform/ingest/jobtech"))
    from ingest_governance_terms import ad_text
    from ingest_history import download
    from ingest_market import ARCHIVES, published_archives, remote_stamp

    for name in names or published_archives():
        # A sample goes to its own folder, which dbt does not read.
        folder, source = (OUT / "sample" if sample else OUT), f"ads_{name}"
        stamp = {**remote_stamp(name), "dictionary_sha256": dictionary, "sample": sample}
        if not force and unchanged(folder, source, stamp):
            print(f"{name}: unchanged archive and terms, skipped", flush=True)
            continue
        path, url = download(name, ARCHIVES)
        counts, seen = Counts(terms), set()
        with zipfile.ZipFile(path) as archive, archive.open(
                next(n for n in archive.namelist() if n.endswith(".jsonl"))) as lines:
            for line in lines:
                if not line.strip():
                    continue
                ad = json.loads(line)
                key = str(ad.get("id"))
                if key in seen:
                    continue
                seen.add(key)
                counts.add((ad.get("publication_date") or "")[:10], ad_text(ad))
                if sample and len(seen) >= sample:
                    break
        counts.write(folder, source, {**stamp, "archive": name, "source_url": url, "sha256": sha256(path)})
        print(f"{name}: {len(seen):,} ads, {sum(counts.hits.values()):,} term matches", flush=True)
        if not sample:
            path.unlink()


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("corpus", choices=["speeches", "ads"])
    parser.add_argument("--archives", nargs="+", help="ads: default every published archive from 2020")
    parser.add_argument("--sample", type=int, help="ads: stop after this many ads per archive (a test run)")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    terms, dictionary = load_terms()
    if args.corpus == "speeches":
        speeches(terms, dictionary, args.force)
    else:
        ads(terms, dictionary, args.archives, args.sample, args.force)


if __name__ == "__main__":
    main()
