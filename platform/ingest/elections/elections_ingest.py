"""Fetch Riksdag election results, seats and the party preference survey.

    python platform/ingest/elections/elections_ingest.py

SCB (PxWeb), under warehouse/raw/scb/:
    election_country        ME0104T3 with region eliminated: votes and shares, Sweden, 1973-2022
    election_municipality   ME0104T3 per municipality, 1973-2022
    election_seats          Riksdagsmandat, seats per party in the country, 1973-2022
    psu                     Vid10, "if there were an election today" (PSU), 1972 to the latest
                            May or November survey, with margins of error

Riksdagen, under warehouse/raw/riksdagen/formation/:
    <term>.json             the Riksdag's own news on forming a government since the latest
                            election (the Speaker's talks, assignments, votes on a prime
                            minister), so the site can say where the process stands

Valmyndigheten, under warehouse/raw/val/:
    <val>/RD_<S|P>.json     the national Riksdag result as the official results site serves
                            it: votes, shares and seats per party. SCB publishes an election
                            some months after it is held, so the latest election comes from
                            here; the one before is fetched too, to reconcile the two sources.
"""
from __future__ import annotations

import sys
import urllib.parse
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "lib"))

import rawstore  # noqa: E402
from pxweb import download_table  # noqa: E402

SCB = "https://api.scb.se/OV0104/v1/doris/sv/ssd"
VAL = "https://resultat.val.se/data/resultat"
ELECTIONS_FROM_VALMYNDIGHETEN = ("val2022", "val2026")
LATEST_ELECTION_DATE = "2026-09-13"
FORMATION_SEARCH = "https://data.riksdagen.se/dokumentlista/"
FORMATION_TERMS = ("regeringsbildning", "sonderingsuppdrag", "statsminister", "statsministeromröstning",
                   "talmannen", "regeringsförklaring")

TABLES = {
    "election_country": ("ME/ME0104/ME0104C/ME0104T3", None, ("Region",)),
    "election_municipality": ("ME/ME0104/ME0104C/ME0104T3", None, ()),
    "election_seats": ("ME/ME0104/ME0104C/Riksdagsmandat", {"Region": ["VR00"]}, ()),
    "psu": ("ME/ME0201/ME0201A/Vid10", None, ()),
}


def main() -> None:
    http = rawstore.session()
    for dataset, (path, selections, eliminate) in TABLES.items():
        parts = download_table(http, "scb", dataset, f"{SCB}/{path}", selections,
                               eliminate=eliminate, pause=0.5)
        print(f"scb/{dataset}: {len(parts)} part(s)", flush=True)
    # The search takes one term at a time; the export merges and de-duplicates the pages.
    for term in FORMATION_TERMS:
        query = urllib.parse.urlencode({"sok": term, "from": LATEST_ELECTION_DATE, "sz": 200,
                                        "sort": "datum", "sortorder": "desc", "utformat": "json"})
        rawstore.fetch(http, "riksdagen", f"formation/{term}.json",
                       f"{FORMATION_SEARCH}?{query}", pause=0.3)
    print(f"riksdagen/formation: news since the election ({len(FORMATION_TERMS)} searches)")
    for election in ELECTIONS_FROM_VALMYNDIGHETEN:
        # Final (S) once the count is certified; preliminary (P) until then.
        for count in ("S", "P"):
            response = http.get(f"{VAL}/{election}/RD_{count}.json", timeout=120)
            if response.status_code == 200:
                rawstore.store("val", f"{election}/RD_{count}.json", response.content,
                               url=response.url)
                print(f"val/{election}: {'final' if count == 'S' else 'preliminary'} result")
                break
        else:
            print(f"val/{election}: no result published")


if __name__ == "__main__":
    main()
