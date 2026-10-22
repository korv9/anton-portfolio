"""SWEDEN B, The Ideal Human: what job ads ask of people, counted in every archive since 2006.

    python platform/ingest/jobtech/ad_language.py                         # every published archive
    python platform/ingest/jobtech/ad_language.py --archives 2006 2025
    python platform/ingest/jobtech/ad_language.py --corpus warehouse/raw/jobtech/cluster-corpus/2024

The categories are the regular expressions in seeds/sweden_language/ad_language_terms.csv, matched in
each ad's headline and description. Like ingest_governance_terms.py this keeps no ads: it
streams one archive (CC0, JobTech historical ads) at a time, counts and deletes it. Ads that
repeat the same text (one ad posted for many workplaces) are counted once, so rates follow
distinct texts. Per archive, under warehouse/features/sweden/ad_language/:

    totals_<archive>.parquet    year × occupation field × county × length band: ads, distinct
                                texts, words
    hits_<archive>.parquet      the same cells × category: distinct texts matching, matches; the
                                sub-terms of seeds/sweden_language/ad_language_subterms.csv are
                                categories of their own here, each match of the parent given to
                                the one sub-term that matches it whole
    mix_<archive>.parquet       year × SSYK-4 occupation group × employer type × category, for
                                the composition of a change by occupation and by employer
    employers_<archive>.parquet the employer names read as staffing or recruitment agencies, with
                                their distinct texts, so the rule can be checked
    coding_<archive>.parquet    per category, the 40 matches with the lowest seeded hash: the pool
                                the manual-coding sample is drawn from (language_coding.py)
    examples_<archive>.parquet  per category, the five matches with the lowest hash of the ad text
                                (a reproducible draw): headline and a short masked window
    manifest_<archive>.json     source URL and SHA-256, the dictionary's SHA-256, counts

An archive is counted again only when it or the dictionary changed.
"""
from __future__ import annotations

import argparse
import bisect
import csv
import hashlib
import heapq
import json
import os
import re
import sys
import time
import zipfile
from collections import Counter, defaultdict
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
OUT = Path(os.environ.get("PORTFOLIO_FEATURES", REPO / "warehouse/features")) / "sweden/ad_language"
# Downloads go next to the other raw files when PORTFOLIO_RAW points elsewhere.
ARCHIVE_DIR = (Path(os.environ["PORTFOLIO_RAW"]) / "jobtech/archives" if os.environ.get("PORTFOLIO_RAW")
               else ARCHIVES)
TERMS = REPO / "platform/seeds/sweden_language/ad_language_terms.csv"
SUBTERMS = REPO / "platform/seeds/sweden_language/ad_language_subterms.csv"
EXAMPLES = 5
# Length bands: a distinct text with at most BANDS[0] words is band 0, and so on to band 3. The
# cuts are the quartiles of words per distinct text published in 2010 (the 2010 archive), so a
# year can be compared with itself at the length ads had then.
BANDS = (86, 182, 275)
# Staffing and recruitment agencies, read from the employer name. They write ads for clients and
# spread stock phrases, so a change can come from who advertises. Checked on employers_*.parquet.
AGENCY = re.compile(r"bemanning|rekryter|recruit|staffing|personaluthyrning|manpower|adecco|randstad"
                    r"|proffice|academic work|uniflex|poolia|jobandtalent|student ?consulting|perido"
                    r"|dfind|experis|instaff|studentjobb|lernia", re.I)
CODING = 40
CODING_SEED = b"20261021"
WORD = re.compile(r"\w+")
# Archives before about 2016 name only a legacy AMS occupation id; JobTech's taxonomy (CC0)
# maps it to today's occupation field.
TAXONOMY = ("https://taxonomy.api.jobtechdev.se/v1/taxonomy/graphql?" + urlencode({"query": (
    'query { concepts(type: "occupation-name", include_deprecated: true, limit: 100000) '
    '{ deprecated_legacy_id broader(type: "ssyk-level-4") { ssyk_code_2012 '
    'broader(type: "occupation-field") { preferred_label } } } }')}))


def load_subterms(path: Path = SUBTERMS) -> tuple[dict[str, list[tuple[str, re.Pattern]]], bytes]:
    """parent category -> [(sub-term, pattern matched against one whole parent match)]."""
    raw = path.read_bytes().replace(b"\r\n", b"\n")
    out: dict = defaultdict(list)
    for r in csv.DictReader(raw.decode("utf-8").splitlines()):
        out[r["parent"]].append((r["term_id"], re.compile(r["pattern"], re.I)))
    return dict(out), raw


def dictionary_sha(terms_sha: str, subterms_raw: bytes) -> str:
    """Everything that changes the counts: patterns, sub-terms, length bands, agency rule."""
    return hashlib.sha256(b"|".join([terms_sha.encode(), subterms_raw, str(BANDS).encode(),
                                     AGENCY.pattern.encode()])).hexdigest()


def legacy_fields() -> dict[str, tuple[str, str | None]]:
    sys.path.insert(0, str(REPO / "platform/lib"))
    from rawstore import fetch, session

    path = fetch(session(), "jobtech", "taxonomy/occupation-name-legacy.json", TAXONOMY, max_age_days=30)
    out = {}
    for c in json.loads(path.read_text(encoding="utf-8"))["data"]["concepts"]:
        fields = [(f["preferred_label"], b.get("ssyk_code_2012")) for b in c["broader"] for f in b["broader"]]
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
                field, group = legacy.get(str(first(ad.get("occupation")).get("legacy_ams_taxonomy_id")),
                                          (None, None))
                # Archives before about 2016 carry no ad id; such a line is its own ad.
                yield {"id": str(ad["id"]) if ad.get("id") else None, "published": ad.get("publication_date") or "",
                       "title": ad.get("headline") or "", "text": body or "",
                       "field": first(ad.get("occupation_field")).get("label") or field,
                       "region": first(ad.get("workplace_address")).get("region"),
                       "group": group, "employer": (ad.get("employer") or {}).get("name")}


def from_corpus(folder: Path):
    """The same fields from a full-text corpus folder written by full_corpus.py."""
    for shard in sorted(folder.glob("part-*.parquet")):
        table = pq.read_table(shard, columns=["observation_id", "published_at", "title",
                                              "description", "occupation_field", "region"])
        for r in table.to_pylist():
            yield {"id": r["observation_id"], "published": r["published_at"] or "",
                   "title": r["title"] or "", "text": r["description"] or "",
                   "field": r["occupation_field"], "region": r["region"], "group": None,
                   "employer": None}


def keep_lowest(heap: list, size: int, rank: int, key: bytes, item: dict) -> None:
    """Keep the `size` lowest ranks: a max-heap on the negated rank."""
    if len(heap) < size or rank < -heap[0][0]:
        heapq.heappush(heap, (-rank, key, item))
        if len(heap) > size:
            heapq.heappop(heap)


def subterm(parent: str, match: re.Match, subterms: dict) -> str | None:
    """The one sub-term of the parent category that matches this match whole."""
    return next((s for s, p in subterms.get(parent, []) if p.fullmatch(match.group(0))), None)


def count(ads, terms, subterms: dict | None = None):
    totals: dict = defaultdict(lambda: [0, 0, 0])  # ads, distinct texts, words
    hits: dict = defaultdict(lambda: [0, 0])  # distinct texts matching, matches
    mix: dict = defaultdict(lambda: [0, 0])  # distinct texts, words
    mix_hits: dict = defaultdict(lambda: [0, 0])
    draws: dict = defaultdict(list)  # category -> heap of (-hash, example)
    coding: dict = defaultdict(list)  # category -> heap of (-seeded hash, candidate)
    employers: Counter = Counter()
    seen_ids: set[str] = set()
    seen_texts: set[bytes] = set()
    read = duplicate_ids = 0
    subterms = subterms or {}
    for ad in ads:
        read += 1
        if ad["id"] is not None:
            if ad["id"] in seen_ids:
                duplicate_ids += 1
                continue
            seen_ids.add(ad["id"])
        text = f"{ad['title']}\n{ad['text']}"
        words = len(WORD.findall(text))
        cell = (ad["published"][:4], ad["field"], ad["region"], bisect.bisect_left(BANDS, words))
        totals[cell][0] += 1
        digest = hashlib.sha1(" ".join(text.lower().split()).encode()).digest()
        if digest in seen_texts:
            continue
        seen_texts.add(digest)
        totals[cell][1] += 1
        totals[cell][2] += words
        employer = (ad.get("employer") or "").strip()
        kind = "agency" if AGENCY.search(employer) else "other" if employer else "unknown"
        if kind == "agency":
            employers[employer] += 1
        group = (cell[0], ad.get("group") or "Unknown", kind)
        mix[group][0] += 1
        mix[group][1] += words
        rank = int(digest.hex()[:15], 16)
        seeded = int.from_bytes(hashlib.sha256(CODING_SEED + digest).digest()[:8], "big")
        for term_id, pattern in terms:
            found = list(pattern.finditer(text))
            if not found:
                continue
            for key in ((*cell, term_id), (*group, term_id)):
                tally = (hits if len(key) == 5 else mix_hits)[key]
                tally[0] += 1
                tally[1] += len(found)
            subs = Counter(subterm(term_id, m, subterms) for m in found)
            subs.pop(None, None)
            for sub, n in subs.items():
                hits[(*cell, sub)][0] += 1
                hits[(*cell, sub)][1] += n
            match = found[0]
            keep_lowest(draws[term_id], EXAMPLES, rank, digest, {
                "category": term_id, "ad_id": ad["id"] or digest.hex()[:16], "year": cell[0],
                "field": ad["field"], "headline": ad["title"][:160],
                "matched": match.group(0), "context": window(text, match)})
            keep_lowest(coding[term_id], CODING, seeded, digest, {
                "category": term_id, "subterm": subterm(term_id, match, subterms), "rank": seeded,
                "ad_id": ad["id"] or digest.hex()[:16], "year": cell[0], "field": ad["field"],
                "employer_type": kind, "headline": ad["title"][:160],
                "matched": match.group(0), "context": window(text, match)})
    examples = [e for heap in draws.values() for _, _, e in sorted(heap, reverse=True)]
    candidates = [e for heap in coding.values() for _, _, e in sorted(heap, reverse=True)]
    stats = {"ads_read": read, "duplicate_ids": duplicate_ids, "ads": read - duplicate_ids,
             "distinct_texts": len(seen_texts)}
    extra = {"mix": mix, "mix_hits": mix_hits, "employers": employers, "coding": candidates}
    return totals, hits, examples, stats, extra


def write(name: str, totals, hits, examples, manifest: dict, extra: dict, categories: list[str]) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    write_rows([{"archive": name, "year": y, "field": f, "region": r, "band": b, "ads": a,
                 "distinct_texts": d, "words": w}
                for (y, f, r, b), (a, d, w) in totals.items()], OUT / f"totals_{name}.parquet")
    write_rows([{"archive": name, "year": y, "field": f, "region": r, "band": b, "category": c,
                 "texts": t, "matches": m}
                for (y, f, r, b, c), (t, m) in hits.items()], OUT / f"hits_{name}.parquet")
    mix_hits = extra["mix_hits"]
    write_rows([{"archive": name, "year": y, "occupation_group": g, "employer_type": k, "category": c,
                 "texts": t, "words": w, "texts_matching": mix_hits.get((y, g, k, c), (0, 0))[0],
                 "matches": mix_hits.get((y, g, k, c), (0, 0))[1]}
                for (y, g, k), (t, w) in extra["mix"].items() for c in categories], OUT / f"mix_{name}.parquet")
    write_rows([{"archive": name, "employer": e, "texts": n} for e, n in extra["employers"].most_common(500)],
               OUT / f"employers_{name}.parquet")
    write_rows([{"archive": name, **e} for e in extra["coding"]], OUT / f"coding_{name}.parquet")
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
    terms, terms_sha = load_terms(TERMS)
    subterms, subterms_raw = load_subterms()
    dictionary = dictionary_sha(terms_sha, subterms_raw)
    categories = [t for t, _ in terms]
    shape = {"bands": list(BANDS), "subterms_sha256": hashlib.sha256(subterms_raw).hexdigest()}
    legacy = {} if args.corpus else legacy_fields()
    now = lambda: datetime.now(timezone.utc).isoformat(timespec="seconds")  # noqa: E731
    for folder in args.corpus or []:
        state = json.loads((folder / "state.json").read_text(encoding="utf-8"))
        name = folder.name
        started = time.monotonic()
        totals, hits, examples, stats, extra = count(from_corpus(folder), terms, subterms)
        write(name, totals, hits, examples, {
            "archive": name, "source_url": state["source"], "sha256": state["source_sha256"],
            **stats, "dictionary_sha256": dictionary, **shape, "counted_at": now(), "from": "corpus"},
            extra, categories)
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
        path, url = download(name, ARCHIVE_DIR)
        totals, hits, examples, stats, extra = count(from_archive(path, legacy), terms, subterms)
        write(name, totals, hits, examples, {
            "archive": name, "source_url": url, "sha256": sha256(path), **stamp, **stats,
            "dictionary_sha256": dictionary, **shape, "counted_at": now(), "from": "archive"},
            extra, categories)
        print(f"{name}: {stats['distinct_texts']:,} distinct texts of {stats['ads']:,} ads, "
              f"{time.monotonic() - started:.0f}s", flush=True)
        if not args.keep:
            path.unlink()


if __name__ == "__main__":
    main()
