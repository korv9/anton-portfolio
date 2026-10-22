"""SWEDEN E, the DiVA 2024-25 jump: which part of the future marker, which subject area and which
degree level carry the rise in future-oriented thesis abstracts.

    python platform/ingest/diva/futures_theses_detail.py                 # 2019-01 to last full month
    python platform/ingest/diva/futures_theses_detail.py --max-months 6

Harvests DiVA's OAI set `studentThesis` one record month at a time, with harvest.py's parser and
futures_theses.py's rule for the Swedish abstract (first dc:language Swedish, a publication year,
the description with the clearest Swedish lead). Each match of the future marker in
seeds/sweden_futures/future_terms.csv is assigned to one alternative (ALTERNATIVES), so the
alternatives add up to the marker. No abstract text, title or keyword is stored.

Writes <PORTFOLIO_FEATURES>/sweden/futures_theses_detail/<month>.parquet, one row per record: month,
id, publication year (null when deleted or without a Swedish abstract), the record's OAI setSpecs
(institution, HSV subject area), its dc:type values, words, and one count per alternative.
done.json lists finished months, so a stopped run resumes. A record changed later comes back in a
later month; the mart keeps each identifier's latest month, as int_sweden_future_theses_latest does.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import xml.etree.ElementTree as ET
from datetime import date
from pathlib import Path

import pyarrow as pa
import pyarrow.parquet as pq

REPO = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO / "platform/ingest/diva"))

from futures_theses import SWEDISH, TERMS, WORD, load_terms, swedish  # noqa: E402
from harvest import NS, get, months, parse  # noqa: E402

OUT = Path(os.environ.get("PORTFOLIO_FEATURES", REPO / "warehouse/features")) / "sweden/futures_theses_detail"
# Bumped when the rows change meaning, so every month is harvested again.
COUNTS = 1
# "framtida forskning", "forskning i framtiden": the closing convention of a thesis abstract.
RESEARCH_AFTER = re.compile(r"\s+(?:forskning\w*|studier\w*|studie\b|undersökning\w*|arbete\w*)", re.I)
RESEARCH_BEFORE = re.compile(r"(?:forskning\w*|studier\w*|undersökning\w*)\s+(?:i|inom)\s+$", re.I)
ALTERNATIVES = ["research", "framtiden", "framtida", "framtid_compound", "long_term", "vision", "other"]
SCHEMA = pa.schema([("month", pa.string()), ("id", pa.string()), ("year", pa.int32()),
                    ("sets", pa.string()), ("types", pa.string()), ("words", pa.int32())]
                   + [(f"m_{a}", pa.int32()) for a in ALTERNATIVES])


def alternative(text: str, match: re.Match) -> str:
    """The alternative one match of the future marker belongs to."""
    word = match.group(0).lower()
    if word.startswith("framtid"):
        if (word == "framtida" and RESEARCH_AFTER.match(text, match.end())) or (
                RESEARCH_BEFORE.search(text[max(0, match.start() - 40):match.start()])):
            return "research"
        if word in ("framtid", "framtiden", "framtidens"):
            return "framtiden"
        return "framtida" if word == "framtida" else "framtid_compound"
    if word.startswith("långsiktig") or word == "på lång sikt":
        return "long_term"
    return "vision" if word.startswith("vision") else "other"


def sets_by_id(xml: bytes) -> dict[str, str]:
    root = ET.fromstring(xml)
    return {h.findtext("oai:identifier", default="", namespaces=NS):
            "|".join(s.text for s in h.iterfind("oai:setSpec", NS) if s.text)
            for h in root.iterfind(".//oai:header", NS)}


def harvest(start: str, until: str):
    params = {"verb": "ListRecords", "metadataPrefix": "oai_dc", "set": "studentThesis",
              "from": start, "until": until}
    while True:
        xml = get(params)
        records, token = parse(xml, deleted=True)
        sets = sets_by_id(xml)
        for r in records:
            r["sets"] = sets.get(r["id"], "")
        yield from records
        if not token:
            return
        params = {"verb": "ListRecords", "resumptionToken": token}
        time.sleep(0.5)


def row(r: dict, marker: re.Pattern, month: str) -> dict:
    out = {"month": month, "id": r["id"], "year": None, "sets": r.get("sets", ""),
           "types": "|".join(r.get("types") or []), "words": 0} | {f"m_{a}": 0 for a in ALTERNATIVES}
    abstract = None
    if not r.get("deleted") and (r.get("language") or "").lower() in SWEDISH and r.get("year"):
        abstract = swedish(r.get("descriptions") or [])
    if abstract is None:
        return out
    text = f"{r['title']}\n{abstract}"
    out["year"], out["words"] = r["year"], len(WORD.findall(text))
    for m in marker.finditer(text):
        out[f"m_{alternative(text, m)}"] += 1
    return out


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--from", dest="start", default="2019-01")
    parser.add_argument("--max-months", type=int, help="Harvest at most this many new months this run")
    args = parser.parse_args()
    terms, dictionary = load_terms(TERMS)
    marker = next(p for t, p in terms if t == "future")
    OUT.mkdir(parents=True, exist_ok=True)
    done_path = OUT / "done.json"
    done = json.loads(done_path.read_text()) if done_path.exists() else {}
    if done.get("dictionary_sha256") != dictionary or done.get("counts") != COUNTS:
        done = {"dictionary_sha256": dictionary, "counts": COUNTS, "from": args.start, "months": []}
        for stale in OUT.glob("*.parquet"):
            stale.unlink()
    today = date.today()
    current = f"{today.year:04d}-{today.month:02d}"
    todo = [(m, a, b) for m, a, b in months(args.start, current) if m != current and m not in done["months"]]
    for key, start, until in todo[:args.max_months]:
        # A record seen twice in one month counts once; rows, not records, are kept to hold memory low.
        rows = list({r["id"]: row(r, marker, key) for r in harvest(start, until)}.values())
        pq.write_table(pa.Table.from_pylist(rows, schema=SCHEMA), OUT / f"{key}.parquet", compression="zstd")
        done["months"].append(key)
        done["complete"] = False
        done_path.write_text(json.dumps(done, indent=2) + "\n")
        print(f"diva detail {key}: {sum(r['year'] is not None for r in rows)} Swedish abstracts", flush=True)
    left = sum(1 for m, _, _ in months(args.start, current) if m != current and m not in done["months"])
    done["complete"] = left == 0
    done_path.write_text(json.dumps(done, indent=2) + "\n")
    print(f"diva detail: {len(done['months'])} months counted, {left} left")


if __name__ == "__main__":
    main()
