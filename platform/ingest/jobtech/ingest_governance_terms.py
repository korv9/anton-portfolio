"""Count AI governance and compliance words in every job ad of JobTech's historical archives.

    python platform/ingest/jobtech/ingest_governance_terms.py            # every archive from 2020
    python platform/ingest/jobtech/ingest_governance_terms.py --archives 2025 2026-Q1

The terms are the regular expressions in seeds/job_ai_governance/job_ai_governance_terms.csv,
matched in each ad's headline and description. Like ingest_market.py this keeps no ads: it
streams each archive once and counts. Per archive, under warehouse/raw/jobtech/governance/:

    totals_<archive>.parquet    ads per publication month and occupation field (the denominator)
    terms_<archive>.parquet     ads matching each term per month and occupation field
    examples_<archive>.parquet  for reviewing the dictionary: per term, up to eight ads with the
                                headline, occupation, month and a short window around the match
                                (e-mail addresses and phone numbers masked)
    manifest_<archive>.json     source URL, SHA-256 of the archive, the dictionary's SHA-256,
                                ads read and duplicates

An archive is counted again only when the archive or the dictionary changed. Duplicate ad ids
within an archive are counted once, as in ingest_market.py.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import sys
import time
import zipfile
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

import pyarrow as pa
import pyarrow.parquet as pq

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

try:
    from .ingest_history import download
    from .ingest_market import ARCHIVES, first, published_archives, remote_stamp, sha256
except ImportError:
    from ingest_history import download
    from ingest_market import ARCHIVES, first, published_archives, remote_stamp, sha256

REPO = Path(__file__).resolve().parents[3]
OUT = REPO / "warehouse/raw/jobtech/governance"
TERMS = REPO / "platform/seeds/job_ai_governance/job_ai_governance_terms.csv"
EXAMPLES = 8
WINDOW = 90
EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
PHONE = re.compile(r"(?:\+46|0)[\d\s-]{6,}\d")


def load_terms(path: Path = TERMS) -> tuple[list[tuple[str, re.Pattern]], str]:
    raw = path.read_bytes()
    rows = list(csv.DictReader(raw.decode("utf-8").splitlines()))
    terms = [(r["term_id"], re.compile(r["pattern"], 0 if r["case_sensitive"] == "true" else re.I))
             for r in rows]
    return terms, hashlib.sha256(raw).hexdigest()


def ad_text(ad: dict) -> str:
    description = ad.get("description") or {}
    body = description.get("text") if isinstance(description, dict) else str(description)
    return f"{ad.get('headline') or ''}\n{body or ''}"


def window(text: str, match: re.Match) -> str:
    lo, hi = max(0, match.start() - WINDOW), min(len(text), match.end() + WINDOW)
    piece = " ".join(text[lo:hi].split())
    return PHONE.sub("[telefon]", EMAIL.sub("[e-post]", piece))


def count(path: Path, terms: list[tuple[str, re.Pattern]]):
    totals: dict = defaultdict(int)
    hits: dict = defaultdict(int)
    examples: dict = defaultdict(list)
    seen: set[str] = set()
    read = duplicates = 0
    with zipfile.ZipFile(path) as archive:
        name = next(n for n in archive.namelist() if n.endswith(".jsonl"))
        with archive.open(name) as lines:
            for line in lines:
                if not line.strip():
                    continue
                ad = json.loads(line)
                read += 1
                key = str(ad.get("id"))
                if key in seen:
                    duplicates += 1
                    continue
                seen.add(key)
                month = (ad.get("publication_date") or "")[:7]
                field = first(ad.get("occupation_field"))
                cell = (month, field.get("concept_id"), field.get("label"))
                totals[cell] += 1
                text = ad_text(ad)
                for term_id, pattern in terms:
                    match = pattern.search(text)
                    if not match:
                        continue
                    hits[(*cell, term_id)] += 1
                    if len(examples[term_id]) < EXAMPLES:
                        examples[term_id].append({
                            "term_id": term_id, "ad_id": key, "publication_month": month,
                            "headline": (ad.get("headline") or "")[:160],
                            "occupation": first(ad.get("occupation")).get("label"),
                            "field": field.get("label"), "matched": match.group(0),
                            "context": window(text, match),
                        })
    return totals, hits, examples, {"ads_read": read, "duplicates": duplicates, "ads": len(seen)}


def write_rows(rows: list[dict], path: Path) -> None:
    if not rows:
        return
    pq.write_table(pa.Table.from_pylist(rows), path, compression="zstd")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--archives", nargs="+", help="Default: every published archive from 2020")
    parser.add_argument("--keep", action="store_true", help="Keep the downloaded archives")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    terms, dictionary = load_terms()
    for name in args.archives or published_archives():
        started = time.monotonic()
        manifest_path = OUT / f"manifest_{name}.json"
        stamp = remote_stamp(name)
        previous = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
        if (previous and not args.force and previous.get("dictionary_sha256") == dictionary
                and all(previous.get(k) == v for k, v in stamp.items())):
            print(f"{name}: unchanged archive and dictionary, skipped", flush=True)
            continue
        path, url = download(name, ARCHIVES)
        totals, hits, examples, stats = count(path, terms)
        write_rows([{"publication_month": m, "field_id": f, "field": fl, "ads": n}
                    for (m, f, fl), n in totals.items()], OUT / f"totals_{name}.parquet")
        write_rows([{"publication_month": m, "field_id": f, "field": fl, "term_id": t, "ads": n}
                    for (m, f, fl, t), n in hits.items()], OUT / f"terms_{name}.parquet")
        write_rows([e for rows in examples.values() for e in rows], OUT / f"examples_{name}.parquet")
        manifest_path.write_text(json.dumps({
            "archive": name, "source_url": url, "sha256": sha256(path), **stamp, **stats,
            "dictionary_sha256": dictionary,
            "counted_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        }, indent=2) + "\n")
        print(f"{name}: {stats['ads']:,} ads, {sum(hits.values()):,} term hits, "
              f"{time.monotonic() - started:.0f}s", flush=True)
        if not args.keep:
            path.unlink()


if __name__ == "__main__":
    main()
