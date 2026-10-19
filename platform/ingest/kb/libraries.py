"""Fetch Sweden's libraries from KB's Biblioteksdatabasen (Libris), page by page.

KB publishes the database through an open API ("data som är fritt tillgängliga", kb.se/om-oss/
oppna-apier.html); contact details need a key and are not requested. Each library has a type
(folkbib = public library), its municipality code, coordinates and whether it is still alive.
SWEDEN D, The Infrastructure of Belonging, reads the public libraries.

It also fetches four terms of the official library statistics (KB, bibstat, CC0; one
observation per library organisation and year from 2014): staffed service points, physical
visits, public activities and active borrowers.

Writes warehouse/raw/kb/: libraries-NNN.json (200 libraries per page, sealed when the last page
arrived) and statistics/<term>.json.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "lib"))

import rawstore  # noqa: E402
from rawstore import fetch, session  # noqa: E402

SOURCE = "kb"
API = "https://bibdb.libris.kb.se/api/lib?dump=true&format=json&level=full"
PAGE = 200
STATISTICS = "https://bibstat.kb.se/data?term={term}&limit=20000"
TERMS = ["BemanService01", "Besok01", "Publ199", "Aktiv99"]


def main() -> None:
    http = session()
    statistics(http)
    request, group = {"url": API, "page": PAGE}, "libraries"
    if rawstore.completed_paths(SOURCE, group, request, 6):
        print("kb: libraries fetched this week, reused")
        return
    rawstore.invalidate(SOURCE, group)
    paths, start = [], 0
    while True:
        path = fetch(http, SOURCE, f"libraries-{start // PAGE:03d}.json", f"{API}&start={start}&n={PAGE}",
                     pause=0.5)
        libraries = json.loads(path.read_text(encoding="utf-8")).get("libraries")
        if not isinstance(libraries, list):
            raise ValueError(f"Incomplete Biblioteksdatabasen page at {start}")
        paths.append(path)
        if len(libraries) < PAGE:
            break
        start += PAGE
    for stale in set((rawstore.RAW / SOURCE).glob("libraries-*.json")) - set(paths):
        stale.unlink()
    rawstore.complete(SOURCE, group, paths, request)
    print(f"kb: {len(paths)} page(s)")


def statistics(http) -> None:
    for term in TERMS:
        def complete(payload: bytes) -> None:
            data = json.loads(payload)
            if not isinstance(data.get("observations"), list) or data.get("next"):
                raise ValueError(f"bibstat {term}: incomplete or paginated answer")
        path = fetch(http, SOURCE, f"statistics/{term}.json", STATISTICS.format(term=term),
                     pause=0.5, max_age_days=6, validate=complete)
        print(f"kb: {term} {len(json.loads(path.read_text(encoding='utf-8'))['observations'])} observations")


if __name__ == "__main__":
    main()
