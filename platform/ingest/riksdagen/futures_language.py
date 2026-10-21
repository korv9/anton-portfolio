"""SWEDEN E, The Lost Futures: how the Riksdag speaks of the future, session by session since 1993/94.

    python platform/ingest/riksdagen/futures_language.py                 # every session
    python platform/ingest/riksdagen/futures_language.py --sessions 199394 202526

The terms are seeds/sweden_futures/future_terms.csv: a marker for speaking of the future and
nine themes. Each session's speech archive (data.riksdagen.se, Riksdagen's open data) is
streamed once, counted and deleted; no speech text is kept apart from short review examples.
Per session, under warehouse/features/sweden/futures/:

    totals_<session>.parquet    year × party: speeches, future-oriented speeches, words and
                                matches of the future marker
    hits_<session>.parquet      the same × theme: speeches using it, of them future-oriented,
                                and matches
    examples_<session>.parquet  per theme, three future-oriented speeches with the lowest hash
                                of the speech id: date, party, speaker, link and a short window
    manifest_<session>.json     source URL and SHA-256, the dictionary's SHA-256, counts

A session is counted again when its archive, the dictionary or COUNTS changed.
"""
from __future__ import annotations

import argparse
import hashlib
import heapq
import json
import re
import sys
import tempfile
import time
import zipfile
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

import requests

REPO = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO / "platform/ingest/jobtech"))
sys.path.insert(0, str(REPO / "platform/nlp/text"))
sys.path.insert(0, str(REPO / "platform/lib"))

from concepts import paragraphs  # noqa: E402
from ingest_governance_terms import load_terms, window, write_rows  # noqa: E402
from rawstore import session as http_session  # noqa: E402

CATALOG = "https://www.riksdagen.se/sv/dokument-och-lagar/riksdagens-oppna-data/anforanden/"
# Session codes have six digits (199394), except 1999/2000, which has eight (19992000).
ARCHIVE = re.compile(r"https://data\.riksdagen\.se/dataset/anforande/anforande-(\d{8}|\d{6})\.json\.zip")
OUT = REPO / "warehouse/features/sweden/futures"
TERMS = REPO / "platform/seeds/sweden_futures/future_terms.csv"
EXAMPLES = 3
# Bumped when count() writes new columns, so every session is counted again.
COUNTS = 2
WORD = re.compile(r"\w+")
# Riksdagen wrote the Liberals as FP until 2015.
PARTY = {"FP": "L", "fp": "L", "-": None, "": None}


def sessions(http) -> dict[str, str]:
    html = http.get(CATALOG, timeout=60).text
    return dict(sorted({m.group(1): m.group(0) for m in ARCHIVE.finditer(html)}.items()))


def speeches(path: Path):
    with zipfile.ZipFile(path) as z:
        for name in z.namelist():
            if name.endswith(".json"):
                s = json.loads(z.read(name).decode("utf-8-sig"))["anforande"]
                party = (s.get("parti") or "").strip()
                yield {"id": f"{s['dok_id']}-{s['anforande_nummer']}", "date": (s.get("dok_datum") or "")[:10],
                       "party": PARTY.get(party, party.upper() or None), "speaker": s.get("talare"),
                       "text": "\n".join(paragraphs(s.get("anforandetext") or ""))}


def count(rows, terms):
    marker = next(p for t, p in terms if t == "future")
    themes = [(t, p) for t, p in terms if t != "future"]
    totals: dict = defaultdict(lambda: [0, 0, 0, 0])  # speeches, future-oriented, words, marker matches
    hits: dict = defaultdict(lambda: [0, 0, 0])  # speeches using, of them future-oriented, matches
    draws: dict = defaultdict(list)
    seen: set[str] = set()
    for s in rows:
        if s["id"] in seen or not s["text"]:
            continue
        seen.add(s["id"])
        cell = (s["date"][:4], s["party"])
        marked = len(marker.findall(s["text"]))
        future = marked > 0
        totals[cell][0] += 1
        totals[cell][1] += future
        totals[cell][2] += len(WORD.findall(s["text"]))
        totals[cell][3] += marked
        rank = int(hashlib.sha1(s["id"].encode()).hexdigest()[:15], 16)
        for term_id, pattern in themes:
            matches = pattern.findall(s["text"])
            if not matches:
                continue
            hit = hits[(*cell, term_id)]
            hit[0] += 1
            hit[1] += future
            hit[2] += len(matches)
            heap = draws[term_id]
            if future and (len(heap) < EXAMPLES or rank < -heap[0][0]):
                match = pattern.search(s["text"])
                heapq.heappush(heap, (-rank, s["id"], {
                    "theme": term_id, "speech_id": s["id"], "date": s["date"], "party": s["party"],
                    "speaker": s["speaker"], "url": f"https://data.riksdagen.se/anforande/{s['id']}/html",
                    "matched": match.group(0), "context": window(s["text"], match)}))
                if len(heap) > EXAMPLES:
                    heapq.heappop(heap)
    examples = [e for heap in draws.values() for _, _, e in sorted(heap, reverse=True)]
    return totals, hits, examples, {"speeches": len(seen)}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--sessions", nargs="+", help="Session codes such as 199394; default all")
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--max-new", type=int, help="Count at most this many changed sessions this run")
    args = parser.parse_args()
    terms, dictionary = load_terms(TERMS)
    http = http_session()
    OUT.mkdir(parents=True, exist_ok=True)
    counted = 0
    for code, url in sessions(http).items():
        if args.sessions and code not in args.sessions:
            continue
        manifest_path = OUT / f"manifest_{code}.json"
        head = http.head(url, timeout=60, allow_redirects=True)
        stamp = {"content_length": head.headers.get("Content-Length"),
                 "last_modified": head.headers.get("Last-Modified")}
        previous = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
        if (previous and not args.force and previous.get("dictionary_sha256") == dictionary
                and previous.get("counts") == COUNTS
                and all(previous.get(k) == v for k, v in stamp.items())):
            print(f"{code}: unchanged archive and dictionary, skipped", flush=True)
            continue
        if args.max_new is not None and counted >= args.max_new:
            print(f"{code}: left for a later run (--max-new {args.max_new})", flush=True)
            continue
        counted += 1
        started = time.monotonic()
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / f"{code}.zip"
            digest = hashlib.sha256()
            with http.get(url, stream=True, timeout=(30, 300)) as response, path.open("wb") as out:
                response.raise_for_status()
                for chunk in response.iter_content(1 << 20):
                    out.write(chunk)
                    digest.update(chunk)
            totals, hits, examples, stats = count(speeches(path), terms)
        write_rows([{"session": code, "year": y, "party": p, "speeches": n, "future": f, "words": w,
                     "marker_matches": m} for (y, p), (n, f, w, m) in totals.items()], OUT / f"totals_{code}.parquet")
        write_rows([{"session": code, "year": y, "party": p, "theme": t, "speeches": n, "future": f,
                     "matches": m} for (y, p, t), (n, f, m) in hits.items()], OUT / f"hits_{code}.parquet")
        write_rows([{"session": code, **e} for e in examples], OUT / f"examples_{code}.parquet")
        manifest_path.write_text(json.dumps({
            "session": code, "source_url": url, "sha256": digest.hexdigest(), **stamp, **stats,
            "dictionary_sha256": dictionary, "counts": COUNTS,
            "counted_at": datetime.now(timezone.utc).isoformat(timespec="seconds")}, indent=2) + "\n")
        print(f"{code}: {stats['speeches']:,} speeches, {time.monotonic() - started:.0f}s", flush=True)


if __name__ == "__main__":
    main()
