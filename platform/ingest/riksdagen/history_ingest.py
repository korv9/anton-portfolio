"""Fetch every session's roll-call votes and committee reports from Riksdagen open data.

    python platform/ingest/riksdagen/history_ingest.py                 # 1993/94 to now
    python platform/ingest/riksdagen/history_ingest.py --session 2024/25

Two files per session, stored under warehouse/raw/riksdagen/ with provenance:

    votes/<rm>.csv.gz        every member's vote on every roll call (votering-<rm>.csv.zip,
                             unzipped; the layout changed over the years, bronze handles it)
    reports/<rm>-<page>.json the committee reports (betänkanden) of the session: title,
                             committee, decision date, the matter each roll call concerns

The detailed evidence layer (citations, reservations, motions per point) is still built for
recent sessions only; this is the long, even history underneath it.
"""
from __future__ import annotations

import argparse
import io
import json
import sys
import urllib.parse
import zipfile
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "lib"))

import rawstore  # noqa: E402

SOURCE = "riksdagen"
API = "https://data.riksdagen.se"
FIRST_SESSION = 1993


def sessions_until_now() -> list[str]:
    """Every session from 1993/94. A session opens in September."""
    today = date.today()
    last = today.year if today.month >= 9 else today.year - 1
    # The session that spans the century is written in full: 1999/2000, not 1999/00.
    return [f"{year}/{year + 1}" if year == 1999 else f"{year}/{str(year + 1)[-2:]}"
            for year in range(FIRST_SESSION, last + 1)]


def code(session: str) -> str:
    return session.replace("/", "")


def fetch_votes(http, session: str) -> int | None:
    url = f"{API}/dataset/votering/votering-{code(session)}.csv.zip"
    response = http.get(url, timeout=300)
    if response.status_code == 404:
        return None
    response.raise_for_status()
    with zipfile.ZipFile(io.BytesIO(response.content)) as archive:
        name = next(n for n in archive.namelist() if n.endswith(".csv"))
        payload = archive.read(name)
    rawstore.store(SOURCE, f"votes/{code(session)}.csv.gz", payload, url=url)
    return payload.count(b"\n")


def fetch_reports(http, session: str) -> int:
    page, total = 1, 0
    while True:
        query = urllib.parse.urlencode({"doktyp": "bet", "rm": session, "sz": 500, "p": page,
                                        "utformat": "json"})
        url = f"{API}/dokumentlista/?{query}"
        path = rawstore.fetch(http, SOURCE, f"reports/{code(session)}-{page:02d}.json", url,
                              pause=0.3)
        listing = json.loads(path.read_text(encoding="utf-8-sig"))["dokumentlista"]
        documents = listing.get("dokument") or []
        total += len(documents) if isinstance(documents, list) else 1
        if page >= int(listing.get("@sidor") or 1):
            return total
        page += 1


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--session", action="append", help="e.g. 2024/25; default: every session")
    parser.add_argument("--refetch-closed", action="store_true",
                        help="also re-download sessions that closed more than a year ago")
    arguments = parser.parse_args()
    http = rawstore.session()
    sessions = arguments.session or sessions_until_now()
    open_sessions = set(sessions_until_now()[-2:])
    for session in sessions:
        # A session's roll calls do not change once it has closed; the last two are refetched.
        stored = rawstore.RAW / SOURCE / f"votes/{code(session)}.csv.gz"
        if (not arguments.session and not arguments.refetch_closed
                and session not in open_sessions and stored.is_file()):
            continue
        lines = fetch_votes(http, session)
        reports = fetch_reports(http, session)
        print(f"{session}: {'no roll calls published yet' if lines is None else f'{lines:,} member votes'}, "
              f"{reports} committee reports", flush=True)


if __name__ == "__main__":
    main()
