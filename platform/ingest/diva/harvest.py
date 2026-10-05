"""Harvest Swedish student theses from DiVA (diva-portal.org) over OAI-PMH, for clustering their
topics: title, abstract, keywords, year, language, publisher (the university) and type.

DiVA serves Dublin Core over the standard OAI-PMH protocol. Records are fetched month by month
with from/until (resumption tokens followed), kept when dc:type says they are student theses
(the pattern is --types), and written one per line to warehouse/raw/diva/records.jsonl, which the
next run reads back and extends: a month already harvested is not fetched again unless --refresh.

    python platform/ingest/diva/harvest.py --from 2023-01 --to 2025-12
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from calendar import monthrange
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "warehouse/raw/diva"
ENDPOINT = "https://www.diva-portal.org/dice/oai"
NS = {
    "oai": "http://www.openarchives.org/OAI/2.0/",
    "oai_dc": "http://www.openarchives.org/OAI/2.0/oai_dc/",
    "dc": "http://purl.org/dc/elements/1.1/",
}
STUDENT = r"(?i)student\s*thesis|studentuppsats|bachelorThesis|masterThesis|examensarbete"
AGENT = "anton-portfolio/1.0 (+https://github.com/korv9/anton-portfolio)"


def parse(xml: bytes) -> tuple[list[dict], str | None]:
    """Records and the resumption token from one ListRecords page."""
    root = ET.fromstring(xml)
    error = root.find("oai:error", NS)
    if error is not None:
        if error.get("code") == "noRecordsMatch":
            return [], None
        raise RuntimeError(f"OAI error {error.get('code')}: {error.text}")
    out = []
    for rec in root.iterfind(".//oai:record", NS):
        header = rec.find("oai:header", NS)
        if header is None or header.get("status") == "deleted":
            continue
        dc = rec.find(".//oai_dc:dc", NS)
        if dc is None:
            continue

        def all_(tag: str) -> list[str]:
            return [e.text.strip() for e in dc.iterfind(f"dc:{tag}", NS) if e.text and e.text.strip()]

        dates = all_("date")
        year = next((int(m.group()) for d in dates if (m := re.search(r"\b(19|20)\d{2}\b", d))), None)
        out.append({
            "id": header.findtext("oai:identifier", default="", namespaces=NS),
            "title": " ".join(all_("title")),
            "abstract": " ".join(all_("description")),
            "subjects": all_("subject"),
            "types": all_("type"),
            "year": year,
            "language": (all_("language") or [None])[0],
            "publisher": (all_("publisher") or [None])[0],
        })
    token = root.findtext(".//oai:resumptionToken", default="", namespaces=NS).strip() or None
    return out, token


def is_student_thesis(rec: dict, pattern: str = STUDENT) -> bool:
    return any(re.search(pattern, t) for t in rec["types"])


def get(params: dict, tries: int = 4) -> bytes:
    url = f"{ENDPOINT}?{urllib.parse.urlencode(params)}"
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": AGENT})
            with urllib.request.urlopen(req, timeout=120) as r:
                return r.read()
        except Exception as e:  # noqa: BLE001
            if attempt == tries - 1:
                raise
            wait = 2 ** (attempt + 1)
            print(f"  retry in {wait}s ({e})")
            time.sleep(wait)
    raise AssertionError


def months(start: str, end: str):
    y, m = map(int, start.split("-"))
    y2, m2 = map(int, end.split("-"))
    while (y, m) <= (y2, m2):
        yield f"{y:04d}-{m:02d}", f"{y:04d}-{m:02d}-01", f"{y:04d}-{m:02d}-{monthrange(y, m)[1]:02d}"
        m += 1
        if m == 13:
            y, m = y + 1, 1


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--from", dest="start", required=True, help="first month, YYYY-MM")
    ap.add_argument("--to", dest="end", required=True, help="last month, YYYY-MM")
    ap.add_argument("--set", default=None, help="an OAI set to restrict to (optional)")
    ap.add_argument("--types", default=STUDENT, help="regex on dc:type for records to keep")
    ap.add_argument("--refresh", action="store_true", help="fetch months already harvested again")
    args = ap.parse_args()

    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / "records.jsonl"
    done_path = OUT / "months.json"
    done = set(json.loads(done_path.read_text())) if done_path.exists() else set()
    kept = {}
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            r = json.loads(line)
            kept[r["id"]] = r

    for label, start, end in months(args.start, args.end):
        if label in done and not args.refresh:
            continue
        params = {"verb": "ListRecords", "metadataPrefix": "oai_dc", "from": start, "until": end}
        if args.set:
            params["set"] = args.set
        seen = n = 0
        while True:
            records, token = parse(get(params))
            seen += len(records)
            for r in records:
                if is_student_thesis(r, args.types) and r["title"]:
                    kept[r["id"]] = r
                    n += 1
            if not token:
                break
            params = {"verb": "ListRecords", "resumptionToken": token}
            time.sleep(0.5)
        done.add(label)
        print(f"{label}: {seen:,} records, {n:,} student theses")
        path.write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in kept.values()), encoding="utf-8")
        done_path.write_text(json.dumps(sorted(done)))
    print(f"{len(kept):,} theses in {path.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
