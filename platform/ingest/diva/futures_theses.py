"""SWEDEN E, the academic corpus: future-oriented themes in Swedish student-thesis abstracts (DiVA).

    python platform/ingest/diva/futures_theses.py                  # every month not yet counted
    python platform/ingest/diva/futures_theses.py --max-months 60

Harvests DiVA's OAI set `studentThesis` month by month of record datestamp (with
platform/ingest/diva/harvest.py's parser). A thesis whose first dc:language is Swedish usually
carries two abstracts, Swedish and English, in either order; only the one written in Swedish is
counted, with the title, for the future marker and the nine themes of
seeds/sweden_futures/future_terms.csv. No abstract is stored. The datestamp is when DiVA last
changed a record, not when it was written, so a changed or deleted record comes back in a later
month; every record is therefore written with its OAI identifier, and the mart keeps only the
latest month of each identifier. Records before 2000 are fetched as one range. DiVA metadata is CC0.

Writes warehouse/features/sweden/futures_theses/<month>.parquet, one row per record and theme it
matches (month, id, publication year, theme, future-oriented, matches, words; theme '_all' carries
the words, and year is null for a record that is deleted or has no Swedish abstract), and
done.json, with `complete` once every month up to the last full one is counted. The Riksdag
corpus (futures_language.py) is never pooled with this one.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from datetime import date
from pathlib import Path

import pyarrow as pa
import pyarrow.parquet as pq

REPO = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO / "platform/ingest/diva"))
sys.path.insert(0, str(REPO / "platform/ingest/jobtech"))

from harvest import get, months, parse  # noqa: E402
from ingest_governance_terms import load_terms  # noqa: E402

OUT = REPO / "warehouse/features/sweden/futures_theses"
TERMS = REPO / "platform/seeds/sweden_futures/future_terms.csv"
WORD = re.compile(r"\w+")
SWEDISH = {"swe", "sv", "sve"}
# Bumped when the rows change meaning, so every month is harvested again.
COUNTS = 2
# Function words that tell a Swedish abstract from an English one.
SV = set("och att som är för med av på det en till den inte har de om".split())
EN = set("the and of to is in that for with on are this as by".split())
SCHEMA = pa.schema([("month", pa.string()), ("id", pa.string()), ("year", pa.int32()), ("theme", pa.string()),
                    ("future", pa.bool_()), ("matches", pa.int32()), ("words", pa.int32())])


def harvest(start: str, until: str):
    params = {"verb": "ListRecords", "metadataPrefix": "oai_dc", "set": "studentThesis",
              "from": start, "until": until}
    while True:
        records, token = parse(get(params), deleted=True)
        yield from records
        if not token:
            return
        params = {"verb": "ListRecords", "resumptionToken": token}


def swedish(descriptions: list[str]) -> str | None:
    """The description with the clearest lead of Swedish over English function words."""
    best, lead = None, 0
    for d in descriptions:
        words = WORD.findall(d.lower())
        score = sum(w in SV for w in words) - sum(w in EN for w in words)
        if score > lead:
            best, lead = d, score
    return best


def count(records, terms, month: str) -> list[dict]:
    marker = next(p for t, p in terms if t == "future")
    themes = [(t, p) for t, p in terms if t != "future"]
    latest = {r["id"]: r for r in records}  # a record seen twice in one month counts once
    rows = []
    for rid, r in latest.items():
        abstract = None
        if not r.get("deleted") and (r.get("language") or "").lower() in SWEDISH and r.get("year"):
            abstract = swedish(r.get("descriptions") or [])
        if abstract is None:
            rows.append({"month": month, "id": rid, "year": None, "theme": "_all", "future": False,
                         "matches": 0, "words": 0})
            continue
        text = f"{r['title']}\n{abstract}"
        future = marker.search(text) is not None
        rows.append({"month": month, "id": rid, "year": r["year"], "theme": "_all", "future": future,
                     "matches": 0, "words": len(WORD.findall(text))})
        for term_id, pattern in themes:
            if n := len(pattern.findall(text)):
                rows.append({"month": month, "id": rid, "year": r["year"], "theme": term_id,
                             "future": future, "matches": n, "words": 0})
    return rows


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--from", dest="start", default="2000-01")
    parser.add_argument("--max-months", type=int, help="Harvest at most this many new months this run")
    args = parser.parse_args()
    terms, dictionary = load_terms(TERMS)
    OUT.mkdir(parents=True, exist_ok=True)
    done_path = OUT / "done.json"
    done = json.loads(done_path.read_text()) if done_path.exists() else {}
    if done.get("dictionary_sha256") != dictionary or done.get("counts") != COUNTS:
        done = {"dictionary_sha256": dictionary, "counts": COUNTS, "months": []}
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
        rows = count(harvest(start, until), terms, key)
        pq.write_table(pa.Table.from_pylist(rows, schema=SCHEMA), OUT / f"{key}.parquet", compression="zstd")
        done["months"].append(key)
        harvested += 1
        done["complete"] = False
        done_path.write_text(json.dumps(done, indent=2) + "\n")
        n = sum(1 for r in rows if r["theme"] == "_all" and r["year"] is not None)
        print(f"diva {key}: {n} Swedish abstracts", flush=True)
    left = sum(1 for k, _, _ in ranges if k not in done["months"])
    done["complete"] = left == 0
    done_path.write_text(json.dumps(done, indent=2) + "\n")
    print(f"diva futures: {len(done['months'])} months counted, {left} left; dictionary "
          f"{hashlib.sha1(dictionary.encode()).hexdigest()[:8]}")


if __name__ == "__main__":
    main()
