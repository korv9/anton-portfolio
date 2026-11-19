"""Fetch SL's GTFS timetable (Trafiklab's "GTFS Regional", feed SE-sl) and keep its rail part.

Trafiklab serves the feed only with a personal API key. The Mobility Database (MobilityData)
mirrors the same zip daily as its feed mdb-3237 and serves its latest copy without a key, so this
reads that copy; `feed_info.txt` names the publisher (Samtrafiken) and the feed version. Licence:
Trafiklab's open-data terms (CC0 1.0 for GTFS Regional static data).

Writes warehouse/raw/sl_gtfs/: sl.zip as fetched (provenance in the fetch log) and rail/*.txt:
the metro (route_type 401), commuter-rail and local-railway (100) and tram (900) routes, their
trips, those trips' stop times, the stops they call at with their parent stations, the services
those trips run on (calendar, calendar_dates) and feed_info. Every column is kept as published.
The metro gives the stations and their departures; the other rail routes give the interchanges.
"""
from __future__ import annotations

import csv
import io
import zipfile

from portfolio.storage import rawstore
from portfolio.storage.rawstore import fetch, session

SOURCE = "sl_gtfs"
URL = "https://files.mobilitydatabase.org/mdb-3237/latest.zip"
RAIL = {"401", "100", "900"}


def rows(archive: zipfile.ZipFile, name: str):
    with archive.open(name) as handle:
        reader = csv.DictReader(io.TextIOWrapper(handle, encoding="utf-8-sig", newline=""))
        yield reader.fieldnames
        yield from reader


def keep(archive: zipfile.ZipFile, name: str, test) -> list[dict]:
    """Rows of `name` that pass `test`, written to metro/<name> with the published header."""
    source = rows(archive, name)
    header = next(source)
    kept = [row for row in source if test(row)]
    out = rawstore.RAW / SOURCE / "rail" / name
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=header, lineterminator="\n")
        writer.writeheader()
        writer.writerows(kept)
    return kept


def extract(path) -> dict[str, int]:
    archive = zipfile.ZipFile(path)
    kept = keep(archive, "routes.txt", lambda r: r["route_type"] in RAIL)
    routes = {r["route_id"] for r in kept}
    if not any(r["route_type"] == "401" for r in kept):
        raise ValueError("sl_gtfs: no metro routes (route_type 401) in the feed")
    trips = keep(archive, "trips.txt", lambda r: r["route_id"] in routes)
    trip_ids, services = {t["trip_id"] for t in trips}, {t["service_id"] for t in trips}
    stops = {r["stop_id"] for r in keep(archive, "stop_times.txt", lambda r: r["trip_id"] in trip_ids)}
    platforms = keep(archive, "stops.txt", lambda r: r["stop_id"] in stops)
    parents = {p["parent_station"] for p in platforms if p["parent_station"]}
    keep(archive, "stops.txt", lambda r: r["stop_id"] in stops or r["stop_id"] in parents)
    keep(archive, "calendar.txt", lambda r: r["service_id"] in services)
    keep(archive, "calendar_dates.txt", lambda r: r["service_id"] in services)
    keep(archive, "feed_info.txt", lambda r: True)
    return {"routes": len(routes), "trips": len(trip_ids), "stops": len(stops), "stations": len(parents)}


def main() -> None:
    path = fetch(session(), SOURCE, "sl.zip", URL, timeout=600, max_age_days=6)
    counts = extract(path)
    print("sl_gtfs: " + ", ".join(f"{v} {k}" for k, v in counts.items()))


if __name__ == "__main__":
    main()
