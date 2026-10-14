"""Fetch the selected Swedish laws (SFS) from Riksdagen's open data into the bronze store.

    python platform/ingest/sfs/ingest.py

Reads configs/workers_ai/sfs_selection.yaml and fetches each law by its dok_id as plain text
(https://data.riksdagen.se/dokument/sfs-<year>-<number>.text) into
warehouse/raw/sfs/texts/<dok_id>.text, with provenance in raw/sfs/_manifest.jsonl. Riksdagen's
search is fuzzy, so nothing is looked up by name: a text whose "SFS nr:" header differs from the
selection, or whose title differs from the recorded one, fails the run. A law whose header says
"Upphävd:" with a date on or before today is repealed and left out. The kept selection, with
each law's status, is stored as raw/sfs/selection.json for silver and its tests.
"""
from __future__ import annotations

import json
import re
import sys
from datetime import date
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "platform" / "lib"))

import rawstore  # noqa: E402

SOURCE = "sfs"
API = "https://data.riksdagen.se"
SELECTION = ROOT / "configs" / "workers_ai" / "sfs_selection.yaml"
# Riksdagen answers in seconds to minutes; one law at a time with a pause between them.
PAUSE = 3.0


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


def main() -> int:
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
