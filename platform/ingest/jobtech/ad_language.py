"""SWEDEN B, The Ideal Human: what job ads ask of people, counted in every archive since 2006.

    python platform/ingest/jobtech/ad_language.py                         # every published archive
    python platform/ingest/jobtech/ad_language.py --archives 2006 2025
    python platform/ingest/jobtech/ad_language.py --corpus warehouse/raw/jobtech/cluster-corpus/2024

The categories are the regular expressions in seeds/sweden_language/ad_language_terms.csv, matched in
each ad's headline and description. Like ingest_governance_terms.py this keeps no ads: it
streams one archive (CC0, JobTech historical ads) at a time, counts and deletes it. Ads that
repeat the same text (one ad posted for many workplaces) are counted once, so rates follow
distinct texts. Per archive, under warehouse/features/sweden/ad_language/:

    totals_<archive>.parquet    year × occupation field × county: ads, distinct texts, words
    hits_<archive>.parquet      the same cells × category: distinct texts matching, matches
    examples_<archive>.parquet  per category, the five matches with the lowest hash of the ad text
                                (a reproducible draw): headline and a short masked window
    manifest_<archive>.json     source URL and SHA-256, the dictionary's SHA-256, counts

An archive is counted again only when it or the dictionary changed.
"""
from __future__ import annotations

import argparse
import hashlib
import heapq
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

sys.path.insert(0, str(Path(__file__).resolve().parent))

from ingest_governance_terms import load_terms, window, write_rows  # noqa: E402
from ingest_history import download  # noqa: E402
from ingest_market import ARCHIVES, INDEX, first, remote_stamp, sha256  # noqa: E402

import requests  # noqa: E402
from urllib.parse import urlencode  # noqa: E402

REPO = Path(__file__).resolve().parents[3]
OUT = REPO / "warehouse/features/sweden/ad_language"
TERMS = REPO / "platform/seeds/sweden_language/ad_language_terms.csv"
EXAMPLES = 5
WORD = re.compile(r"\w+")
# Archives before about 2016 name only a legacy AMS occupation id; JobTech's taxonomy (CC0)
# maps it to today's occupation field.
TAXONOMY = ("https://taxonomy.api.jobtechdev.se/v1/taxonomy/graphql?" + urlencode({"query": (
    'query { concepts(type: "occupation-name", include_deprecated: true, limit: 100000) '
    '{ deprecated_legacy_id broader(type: "ssyk-level-4") { broader(type: "occupation-field") '
    '{ preferred_label } } } }')}))


def legacy_fields() -> dict[str, str]:
    sys.path.insert(0, str(REPO / "platform/lib"))
    from rawstore import fetch, session

    path = fetch(session(), "jobtech", "taxonomy/occupation-name-legacy.json", TAXONOMY, max_age_days=30)
    out = {}
    for c in json.loads(path.read_text(encoding="utf-8"))["data"]["concepts"]:
        fields = [f["preferred_label"] for b in c["broader"] for f in b["broader"]]
        if c["deprecated_legacy_id"] and fields:
            out[c["deprecated_legacy_id"]] = fields[0]
    return out


def archives() -> list[str]:
    """Every archive in JobTech's listing, from 2006: '2006', ..., '2026-Q3'."""
    html = requests.get(INDEX, timeout=60).text
    return sorted(set(re.findall(r'historiska/(\d{4}(?:-Q\d)?)\.jsonl\.zip', html)))


def from_archive(path: Path, legacy: dict[str, str]):
    """The fields counted here, from one archive's JSONL lines."""
    with zipfile.ZipFile(path) as archive:
        name = next(n for n in archive.namelist() if n.endswith(".jsonl"))
        with archive.open(name) as lines:
            for line in lines:
                if not line.strip():
                    continue
                ad = json.loads(line)
                description = ad.get("description") or {}
                body = description.get("text") if isinstance(description, dict) else description
                # Archives before about 2016 carry no ad id; such a line is its own ad.
                yield {"id": str(ad["id"]) if ad.get("id") else None, "published": ad.get("publication_date") or "",
                       "title": ad.get("headline") or "", "text": body or "",
                       "field": first(ad.get("occupation_field")).get("label")
                       or legacy.get(str(first(ad.get("occupation")).get("legacy_ams_taxonomy_id"))),
                       "region": first(ad.get("workplace_address")).get("region")}


def from_corpus(folder: Path):
    """The same fields from a full-text corpus folder written by full_corpus.py."""
    for shard in sorted(folder.glob("part-*.parquet")):
        table = pq.read_table(shard, columns=["observation_id", "published_at", "title",
                                              "description", "occupation_field", "region"])
        for r in table.to_pylist():
            yield {"id": r["observation_id"], "published": r["published_at"] or "",
                   "title": r["title"] or "", "text": r["description"] or "",
                   "field": r["occupation_field"], "region": r["region"]}


def count(ads, terms):
    totals: dict = defaultdict(lambda: [0, 0, 0])  # ads, distinct texts, words
    hits: dict = defaultdict(lambda: [0, 0])  # distinct texts matching, matches
    draws: dict = defaultdict(list)  # category -> heap of (-hash, example)
    seen_ids: set[str] = set()
    seen_texts: set[bytes] = set()
    read = duplicate_ids = 0
    for ad in ads:
        read += 1
        if ad["id"] is not None:
            if ad["id"] in seen_ids:
                duplicate_ids += 1
                continue
            seen_ids.add(ad["id"])
        cell = (ad["published"][:4], ad["field"], ad["region"])
        totals[cell][0] += 1
        text = f"{ad['title']}\n{ad['text']}"
        digest = hashlib.sha1(" ".join(text.lower().split()).encode()).digest()
        if digest in seen_texts:
            continue
        seen_texts.add(digest)
        totals[cell][1] += 1
        totals[cell][2] += len(WORD.findall(text))
        rank = int(digest.hex()[:15], 16)
        for term_id, pattern in terms:
            matches = pattern.findall(text)
            if not matches:
                continue
            hit = hits[(*cell, term_id)]
            hit[0] += 1
            hit[1] += len(matches)
            # Keep the EXAMPLES lowest hashes per category: a max-heap on the negated hash.
            heap = draws[term_id]
            if len(heap) < EXAMPLES or rank < -heap[0][0]:
                match = pattern.search(text)
                heapq.heappush(heap, (-rank, digest, {
                    "category": term_id, "ad_id": ad["id"] or digest.hex()[:16], "year": cell[0],
                    "field": ad["field"], "headline": ad["title"][:160],
                    "matched": match.group(0), "context": window(text, match)}))
                if len(heap) > EXAMPLES:
                    heapq.heappop(heap)
    examples = [e for heap in draws.values() for _, _, e in sorted(heap, reverse=True)]
    stats = {"ads_read": read, "duplicate_ids": duplicate_ids, "ads": read - duplicate_ids,
             "distinct_texts": len(seen_texts)}
    return totals, hits, examples, stats


def write(name: str, totals, hits, examples, manifest: dict) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    write_rows([{"archive": name, "year": y, "field": f, "region": r, "ads": a,
                 "distinct_texts": d, "words": w}
                for (y, f, r), (a, d, w) in totals.items()], OUT / f"totals_{name}.parquet")
    write_rows([{"archive": name, "year": y, "field": f, "region": r, "category": c,
                 "texts": t, "matches": m}
                for (y, f, r, c), (t, m) in hits.items()], OUT / f"hits_{name}.parquet")
    if examples:
        pq.write_table(pa.Table.from_pylist([{"archive": name, **e} for e in examples]),
                       OUT / f"examples_{name}.parquet", compression="zstd")
    (OUT / f"manifest_{name}.json").write_text(json.dumps(manifest, indent=2) + "\n")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--archives", nargs="+", help="Default: every published archive")
    parser.add_argument("--corpus", nargs="+", type=Path,
                        help="Count already retained corpus folders instead of downloading")
    parser.add_argument("--keep", action="store_true", help="Keep the downloaded archives")
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--max-new", type=int, help="Count at most this many changed archives this run")
    args = parser.parse_args()
    terms, dictionary = load_terms(TERMS)
    legacy = {} if args.corpus else legacy_fields()
    now = lambda: datetime.now(timezone.utc).isoformat(timespec="seconds")  # noqa: E731
    for folder in args.corpus or []:
        state = json.loads((folder / "state.json").read_text(encoding="utf-8"))
        name = folder.name
        started = time.monotonic()
        totals, hits, examples, stats = count(from_corpus(folder), terms)
        write(name, totals, hits, examples, {
            "archive": name, "source_url": state["source"], "sha256": state["source_sha256"],
            **stats, "dictionary_sha256": dictionary, "counted_at": now(), "from": "corpus"})
        print(f"{name}: {stats['distinct_texts']:,} distinct texts, "
              f"{time.monotonic() - started:.0f}s", flush=True)
    if args.corpus:
        return
    counted = 0
    for name in args.archives or archives():
        if args.max_new is not None and counted >= args.max_new:
            print(f"{name}: left for a later run (--max-new {args.max_new})", flush=True)
            continue
        manifest_path = OUT / f"manifest_{name}.json"
        stamp = remote_stamp(name)
        previous = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
        if (previous and not args.force and previous.get("dictionary_sha256") == dictionary
                and (previous.get("from") == "corpus"
                     or all(previous.get(k) == v for k, v in stamp.items()))):
            print(f"{name}: unchanged archive and dictionary, skipped", flush=True)
            continue
        started = time.monotonic()
        counted += 1
        path, url = download(name, ARCHIVES)
        totals, hits, examples, stats = count(from_archive(path, legacy), terms)
        write(name, totals, hits, examples, {
            "archive": name, "source_url": url, "sha256": sha256(path), **stamp, **stats,
            "dictionary_sha256": dictionary, "counted_at": now(), "from": "archive"})
        print(f"{name}: {stats['distinct_texts']:,} distinct texts of {stats['ads']:,} ads, "
              f"{time.monotonic() - started:.0f}s", flush=True)
        if not args.keep:
            path.unlink()


if __name__ == "__main__":
    main()
