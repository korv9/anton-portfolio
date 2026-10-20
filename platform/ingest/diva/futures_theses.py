"""SWEDEN E, the academic corpus: future-oriented themes in Swedish student-thesis abstracts (DiVA).

    python platform/ingest/diva/futures_theses.py                  # every month not yet counted
    python platform/ingest/diva/futures_theses.py --max-months 60

Harvests DiVA's OAI set `studentThesis` month by month of record datestamp (with
platform/ingest/diva/harvest.py's parser), keeps only abstracts written in Swedish, and counts
the future marker and the nine themes of seeds/sweden_futures/future_terms.csv in title and
abstract, by publication year. No abstract is stored. The datestamp is when DiVA last changed a
record, not when it was written, so every month is harvested once and counts are kept per
publication year; records before 2000 are fetched as one range. DiVA metadata is CC0.

Writes warehouse/features/sweden/futures_theses/<month>.parquet (publication year × theme:
abstracts, of them future-oriented, matches; theme '_all' carries the totals and words) and
done.json. The Riksdag corpus (futures_language.py) is never pooled with this one.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from collections import defaultdict
from datetime import date
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO / "platform/ingest/diva"))
sys.path.insert(0, str(REPO / "platform/ingest/jobtech"))

from harvest import get, months, parse  # noqa: E402
from ingest_governance_terms import load_terms, write_rows  # noqa: E402

OUT = REPO / "warehouse/features/sweden/futures_theses"
TERMS = REPO / "platform/seeds/sweden_futures/future_terms.csv"
WORD = re.compile(r"\w+")
SWEDISH = {"swe", "sv", "sve"}


def harvest(start: str, until: str):
    params = {"verb": "ListRecords", "metadataPrefix": "oai_dc", "set": "studentThesis",
              "from": start, "until": until}
    while True:
        records, token = parse(get(params))
        yield from records
        if not token:
            return
        params = {"verb": "ListRecords", "resumptionToken": token}


def count(records, terms):
    marker = next(p for t, p in terms if t == "future")
    themes = [(t, p) for t, p in terms if t != "future"]
    cells: dict = defaultdict(lambda: [0, 0, 0, 0])  # abstracts, future, matches, words
    for r in records:
        if (r.get("language") or "").lower() not in SWEDISH or not r.get("abstract") or not r.get("year"):
            continue
        text = f"{r['title']}\n{r['abstract']}"
        future = marker.search(text) is not None
        total = cells[(r["year"], "_all")]
        total[0] += 1
        total[1] += future
        total[3] += len(WORD.findall(text))
        for term_id, pattern in themes:
            matches = pattern.findall(text)
            if matches:
                cell = cells[(r["year"], term_id)]
                cell[0] += 1
                cell[1] += future
                cell[2] += len(matches)
    return cells


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--from", dest="start", default="2000-01")
    parser.add_argument("--max-months", type=int, help="Harvest at most this many new months this run")
    args = parser.parse_args()
    terms, dictionary = load_terms(TERMS)
    OUT.mkdir(parents=True, exist_ok=True)
    done_path = OUT / "done.json"
    done = json.loads(done_path.read_text()) if done_path.exists() else {}
    if done.get("dictionary_sha256") != dictionary:
        done = {"dictionary_sha256": dictionary, "months": []}
        for stale in OUT.glob("*.parquet"):
            stale.unlink()
    today = date.today()
    current = f"{today.year:04d}-{today.month:02d}"
    ranges = [("before-2000", "1900-01-01", "1999-12-31")] + [
        (m, a, b) for m, a, b in months(args.start, current) if m != current]
    harvested = 0
    for key, start, until in ranges:
        if key in done["months"]:
            continue
        if args.max_months is not None and harvested >= args.max_months:
            break
        cells = count(harvest(start, until), terms)
        write_rows([{"month": key, "year": y, "theme": t, "abstracts": a, "future": f, "matches": m, "words": w}
                    for (y, t), (a, f, m, w) in cells.items()], OUT / f"{key}.parquet")
        done["months"].append(key)
        harvested += 1
        done_path.write_text(json.dumps(done, indent=2) + "\n")
        n = sum(v[0] for (y, t), v in cells.items() if t == "_all")
        print(f"diva {key}: {n} Swedish abstracts", flush=True)
    left = sum(1 for k, _, _ in ranges if k not in done["months"])
    print(f"diva futures: {len(done['months'])} months counted, {left} left; dictionary "
          f"{hashlib.sha1(dictionary.encode()).hexdigest()[:8]}")


if __name__ == "__main__":
    main()
