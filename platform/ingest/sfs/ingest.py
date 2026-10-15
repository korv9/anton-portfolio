"""Fetch the selected Swedish laws (SFS) from Riksdagen's open data into the bronze store.

    python platform/ingest/sfs/ingest.py

Reads configs/workers_ai/sfs_selection.yaml and fetches each law by its dok_id as plain text
(https://data.riksdagen.se/dokument/sfs-<year>-<number>.text) into
warehouse/raw/sfs/texts/<dok_id>.text, with provenance in raw/sfs/_manifest.jsonl. Riksdagen's
search is fuzzy, so nothing is looked up by name: a text whose "SFS nr:" header differs from the
selection, or whose title differs from the recorded one, fails the run. A law whose header says
"Upphävd:" with a date on or before today is repealed and left out. The kept selection, with
each law's status, is stored as raw/sfs/selection.json for silver and its tests.

    python platform/ingest/sfs/ingest.py --all [--sample N]

The whole statute book instead: every page of /dokumentlista/?doktyp=sfs (200 a page, the
API's cap) into raw/sfs/catalogue.json, then each text as above with a 1 s pause. A text is
fetched again only when the list's systemdatum is on or after the day it was last fetched, so
a rerun resumes and picks up amended texts. A text that still fails after the session's retries
is counted and left for the next run. Repealed documents are kept; silver reads "Upphävd:".
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
from datetime import date
from pathlib import Path
from urllib.parse import quote

import requests
import yaml

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "platform" / "lib"))

import rawstore  # noqa: E402

SOURCE = "sfs"
API = "https://data.riksdagen.se"
SELECTION = ROOT / "configs" / "workers_ai" / "sfs_selection.yaml"
# Riksdagen answers in seconds to minutes; one law at a time with a pause between them.
PAUSE = 3.0
# 11,500 texts at 3 s would take about ten hours.
FULL_PAUSE = 1.0
CATALOGUE = ("dok_id", "beteckning", "titel", "datum", "organ", "subtyp", "systemdatum")


def dok_id(sfs: str) -> str:
    year, number = sfs.split(":")
    return f"sfs-{year}-{int(number)}"


def header(text: str) -> dict:
    """The title line and the "Key: value" lines before the first blank-line gap."""
    lines = text.replace("\r\n", "\n").split("\n")
    fields = {"title": lines[0].strip()}
    for line in lines[1:40]:
        match = re.match(r"^([A-ZÅÄÖ][\wåäö/ ]+?):\s*(.*)$", line)
        if match:
            fields.setdefault(match.group(1).strip(), match.group(2).strip())
    return fields


def repealed(fields: dict, today: date) -> str | None:
    match = re.match(r"(\d{4}-\d{2}-\d{2})", fields.get("Upphävd", ""))
    return match.group(1) if match and match.group(1) <= today.isoformat() else None


def catalogue(http: requests.Session) -> list[dict]:
    """Every SFS document in Riksdagen's list. Its status field never marks a repeal.

    The API serves at most 50 pages of 200 for one query, so the list is read newest first
    and then oldest first until every hit has been seen."""
    docs, total = {}, 0
    for order in ("desc", "asc"):
        for page in range(1, 51):
            if total and len(docs) >= total:
                break
            response = http.get(f"{API}/dokumentlista/?doktyp=sfs&utformat=json&sz=200"
                                f"&sort=datum&sortorder={order}&p={page}", timeout=300)
            response.raise_for_status()
            listing = response.json()["dokumentlista"]
            total = int(listing["@traffar"])
            for doc in listing.get("dokument") or []:
                docs[doc["dok_id"]] = {field: doc.get(field) or "" for field in CATALOGUE}
            print(f"Page {page} {order}: {len(docs)} of {total}", flush=True)
            time.sleep(FULL_PAUSE)
            if page >= int(listing["@sidor"]):
                break
    if len(docs) != total:
        print(f"  warning: the list said {total} hits, {len(docs)} distinct dok_ids", flush=True)
    return sorted(docs.values(), key=lambda doc: doc["dok_id"])


def fetch_all(sample: int | None) -> int:
    http = rawstore.session()
    docs = catalogue(http)
    rawstore.store(SOURCE, "catalogue.json",
                   json.dumps(docs, ensure_ascii=False, indent=0).encode("utf-8"),
                   url=f"{API}/dokumentlista/?doktyp=sfs&utformat=json&sz=200", method="LOCAL")
    started, fetched, failed = time.monotonic(), 0, []
    chosen = docs[::max(1, len(docs) // sample)][:sample] if sample else docs
    for doc in chosen:
        relative = f"texts/{doc['dok_id']}.text"
        url = f"{API}/dokument/{quote(doc['dok_id'])}.text"
        record = rawstore.verified_record(SOURCE, relative)
        current = bool(record) and record["fetched_at"][:10] > doc["systemdatum"][:10]
        try:
            rawstore.fetch(http, SOURCE, relative, url, pause=FULL_PAUSE, timeout=300,
                           max_age_days=36500 if current else 0)
            fetched += not current
        except requests.RequestException as error:
            failed.append(doc["dok_id"])
            print(f"  failed {doc['dok_id']}: {error}", flush=True)
    print(f"Listed {len(docs)}, tried {len(chosen)}, fetched {fetched}, failed {len(failed)}, "
          f"{time.monotonic() - started:.0f} s", flush=True)
    return 1 if failed else 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--all", action="store_true", help="the whole statute book")
    parser.add_argument("--sample", type=int, help="with --all, N texts spread over the list")
    args = parser.parse_args()
    if args.all:
        return fetch_all(args.sample)
    laws = yaml.safe_load(SELECTION.read_text(encoding="utf-8"))["laws"]
    http = rawstore.session()
    kept, problems = [], []
    for law in laws:
        identifier = dok_id(law["sfs"])
        url = f"{API}/dokument/{identifier}.text"
        path = rawstore.fetch(http, SOURCE, f"texts/{identifier}.text", url, pause=PAUSE,
                              timeout=300, max_age_days=30)
        text = path.read_bytes().decode("utf-8-sig")
        fields = header(text)
        number = fields.get("SFS nr", "")
        print(f"{law['sfs']:>10}  {len(text):>8} chars  {fields['title']}", flush=True)
        if number != law["sfs"]:
            problems.append(f"{law['sfs']}: header says SFS nr {number!r}")
            continue
        if law.get("title") and law["title"] != fields["title"]:
            problems.append(f"{law['sfs']}: title is now {fields['title']!r}")
            continue
        gone = repealed(fields, date.today())
        if gone:
            print(f"  skipped: repealed {gone}", flush=True)
            continue
        kept.append({"sfs": law["sfs"], "dok_id": identifier, "name": law["name"],
                     "title": fields["title"], "amended_to": fields.get("Ändrad", ""),
                     "path": f"texts/{identifier}.text"})
    rawstore.store(SOURCE, "selection.json",
                   json.dumps(kept, ensure_ascii=False, indent=1).encode("utf-8"),
                   url="configs/workers_ai/sfs_selection.yaml", method="LOCAL")
    print(f"Laws kept: {len(kept)} of {len(laws)}")
    for line in problems:
        print("  problem:", line)
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
