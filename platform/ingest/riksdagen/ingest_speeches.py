"""Fetch every Riksdag speech, session by session, into the bronze store.

    python platform/ingest/riksdagen/ingest_speeches.py [--from 2016/17]

Riksdagen publishes one archive per riksmöte (`anforande-201617.json.zip`, one JSON file per
speech). The list of archives is read from Riksdagen's open-data page and each archive is
stored as served under warehouse/raw/riksdagen/speeches/, with its provenance line in
warehouse/raw/riksdagen/_manifest.jsonl (lib/rawstore.py). A refetch that returns the same
bytes rewrites nothing. Nothing is parsed here: bronze reads the archives
(models/bronze/ai_politics/stg_riksdag_speeches.py).

The default starts at 2016/17, a few years before the Commission proposed the AI Act (2021),
so the period before the Act is part of the comparison.
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "lib"))

import rawstore  # noqa: E402

CATALOG = "https://www.riksdagen.se/sv/dokument-och-lagar/riksdagens-oppna-data/anforanden/"
ARCHIVE = re.compile(r"https://data\.riksdagen\.se/dataset/anforande/anforande-(\d{6})\.json\.zip")
SOURCE = "riksdagen"
PAUSE = 3.0


def archives(html: str, first: str) -> list[tuple[str, str]]:
    """(session code, URL) for each archive from `first` (e.g. '2016/17') on, oldest first."""
    start = first.replace("/", "")[:4]
    found = {m.group(1): m.group(0) for m in ARCHIVE.finditer(html)}
    return sorted((code, url) for code, url in found.items() if code[:4] >= start)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--from", dest="first", default="2016/17")
    args = parser.parse_args()
    http = rawstore.session()
    page = http.get(CATALOG, timeout=60)
    page.raise_for_status()
    found = archives(page.text, args.first)
    if not found:
        raise SystemExit("No speech archives found on Riksdagen's open-data page")
    failed = []
    for code, url in found:
        try:
            rawstore.fetch(http, SOURCE, f"speeches/anforande-{code}.json.zip", url, pause=PAUSE,
                           timeout=600)
            print(f"  {code[:4]}/{code[4:]}: stored", flush=True)
        except Exception as error:  # one failing session should not stop the others
            failed.append(f"{code}: {error}")
    print(f"Speech archives: {len(found)} attempted, {len(failed)} failed")
    for line in failed:
        print("  failed:", line)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
