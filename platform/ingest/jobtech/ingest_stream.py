"""Count the job ads published each day, from JobTech's stream, after the latest archive.

    python platform/ingest/jobtech/ingest_stream.py              # everything since the last run
    python platform/ingest/jobtech/ingest_stream.py --until 2026-10-06T06:00

The archives (ingest_market.py) come once a quarter, months after the period they cover.
JobStream (https://jobstream.api.jobtechdev.se, open, no key) returns every ad created,
changed or removed in a time window, in the archives' shape. Each run asks for everything since
the previous run, in windows of at most six hours, so nothing between two runs is missed.
Under warehouse/raw/jobtech/:

    stream/raw/<window>.json.gz       each answer as served, with its provenance line
                                      (lib/rawstore.py)
    stream/ads/<window>.parquet       the ads first seen in that window, one row each: id,
                                      publication date and the cells it counts in
    stream/state.json                 the first complete day and the time fetched up to
    market/ads_stream.parquet         whole months, in the archives' layout
    market/conditions_stream.parquet  (ingest_market.cells), so dbt reads them like an archive
    market/daily_stream.parquet       ads and vacancies per publication day and field
    market/manifest_stream.json

An ad is counted once, by the day it was published, the first time it is seen; later changes
to it are ignored, and an ad removed later still counts, as it does in the archives.

The stream cannot be read backwards: a window in the past holds only the ads whose last change
fell in it, and a removed ad comes back without its publication date. So the stream counts
from its first run: that day onward is complete (an ad up for less than the time between two
runs aside), the days before are not counted at all. A month enters the monthly series only
when the stream covers it from its first day, and only after the archives end; when the next
quarterly archive is published, dbt uses the archive for its months instead.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
import time
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import pyarrow as pa
import pyarrow.parquet as pq

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "lib"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

import rawstore  # noqa: E402
from ingest_market import ADS_COLUMNS, CONDITIONS_COLUMNS, cells, write  # noqa: E402

STREAM_URL = "https://jobstream.api.jobtechdev.se/stream"
SOURCE = "jobtech"
STREAM = rawstore.RAW / SOURCE / "stream"
MARKET = rawstore.RAW / SOURCE / "market"
STATE = STREAM / "state.json"
# JobStream reads and writes times as Swedish local time, without an offset.
LOCAL = ZoneInfo("Europe/Stockholm")
# A day of changes is about 30 MB of JSON; six hours keeps each answer small enough that a
# dropped connection costs little and is retried.
WINDOW = timedelta(hours=6)
ATTEMPTS = 4
STAMP = "%Y-%m-%dT%H:%M:%S"

AD_SCHEMA = pa.schema([
    ("id", pa.string()), ("publication_date", pa.string()), ("first_seen", pa.string()),
    *[(c, pa.bool_() if c == "experience_required" else pa.string())
      for c in dict.fromkeys(ADS_COLUMNS + CONDITIONS_COLUMNS)],
    ("vacancies", pa.int64()),
])


def archive_end(name: str) -> date:
    """The last day an archive covers: '2025' -> 2025-12-31, '2026-Q2' -> 2026-06-30."""
    year = int(name[:4])
    if "-Q" not in name:
        return date(year, 12, 31)
    quarter = int(name[-1])
    first_of_next = date(year + quarter // 4, quarter % 4 * 3 + 1, 1)
    return first_of_next - timedelta(days=1)


def archives_end() -> date:
    """The last day the counted archives cover."""
    names = [p.stem.removeprefix("manifest_") for p in MARKET.glob("manifest_*.json")]
    names = [n for n in names if n != "stream"]
    if not names:
        sys.exit("No archive counted yet: run ingest_market.py first.")
    return max(archive_end(n) for n in names)


def row(ad: dict, seen: str) -> dict:
    ads_key, conditions_key, vacancies = cells(ad)
    values = dict(zip(ADS_COLUMNS, ads_key)) | dict(zip(CONDITIONS_COLUMNS, conditions_key))
    return {"id": str(ad["id"]), "publication_date": ad["publication_date"][:10],
            "first_seen": seen, **values, "vacancies": vacancies}


def known_ids() -> set[str]:
    files = sorted((STREAM / "ads").glob("*.parquet"))
    if not files:
        return set()
    return set(pq.read_table(files, columns=["id"]).column("id").to_pylist())


def fetch_window(http, start: datetime, end: datetime) -> list[dict]:
    url = (f"{STREAM_URL}?date={start.strftime(STAMP)}"
           f"&updated-before-date={end.strftime(STAMP)}")
    for attempt in range(1, ATTEMPTS + 1):
        response = http.get(url, timeout=900)
        response.raise_for_status()
        try:
            # An answer cut off in transit is not valid JSON: ask again rather than store it.
            items = json.loads(response.content)
        except json.JSONDecodeError as error:
            if attempt == ATTEMPTS:
                raise
            print(f"  answer cut off ({error.msg} at {error.pos:,} bytes), attempt {attempt} "
                  f"of {ATTEMPTS}; retrying", flush=True)
            time.sleep(10 * attempt)
            continue
        rawstore.store(SOURCE, f"stream/raw/{start:%Y-%m-%dT%H%M}.json.gz", response.content,
                       url=url)
        return items
    raise AssertionError("unreachable")


def recount(complete_from: date, last_day: date) -> dict:
    """Counts of the ads the stream has given: whole months in the archives' layout, and
    every complete day from `complete_from` to `last_day`."""
    files = sorted((STREAM / "ads").glob("*.parquet"))
    table = pq.read_table(files, schema=AD_SCHEMA).to_pylist() if files else []
    first: dict[str, dict] = {}
    for ad in sorted(table, key=lambda a: a["first_seen"]):
        first.setdefault(ad["id"], ad)
    ads: dict = defaultdict(lambda: [0, 0])
    conditions: dict = defaultdict(lambda: [0, 0])
    daily: dict = defaultdict(lambda: [0, 0])
    first_month = complete_from.isoformat()[:7] if complete_from.day == 1 else (
        (complete_from.replace(day=28) + timedelta(days=4)).replace(day=1).isoformat()[:7])
    for ad in first.values():
        day = ad["publication_date"]
        if complete_from.isoformat() <= day <= last_day.isoformat():
            for key in ((day, ad["field_id"]), (day, "all")):
                daily[key][0] += 1
                daily[key][1] += ad["vacancies"]
        if day[:7] < first_month:
            continue
        for counter, columns in ((ads, ADS_COLUMNS), (conditions, CONDITIONS_COLUMNS)):
            cell = counter[tuple(ad[c] for c in columns)]
            cell[0] += 1
            cell[1] += ad["vacancies"]
    write(ads, ADS_COLUMNS, MARKET / "ads_stream.parquet")
    write(conditions, CONDITIONS_COLUMNS, MARKET / "conditions_stream.parquet")
    write(daily, ["publication_date", "field_id"], MARKET / "daily_stream.parquet")
    ids = "\n".join(sorted(first)).encode()
    return {"ads_read": len(table), "duplicates": len(table) - len(first), "ads": len(first),
            "first_whole_month": first_month,
            "sha256": hashlib.sha256(ids).hexdigest(),
            "first_publication_date": min((a["publication_date"] for a in first.values()),
                                          default=None),
            "last_publication_date": max((a["publication_date"] for a in first.values()),
                                         default=None)}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--until", help="Local time to fetch up to (default: now)")
    args = parser.parse_args()
    (STREAM / "ads").mkdir(parents=True, exist_ok=True)
    after_archives = archives_end() + timedelta(days=1)
    state = json.loads(STATE.read_text()) if STATE.exists() else {}
    now = datetime.now(LOCAL).replace(tzinfo=None, second=0, microsecond=0)
    until = (datetime.strptime(args.until, "%Y-%m-%dT%H:%M") if args.until
             else now - timedelta(minutes=5))
    if state:
        start = datetime.strptime(state["fetched_until"], STAMP)
        complete_from = date.fromisoformat(state["complete_from"])
    else:
        # The first run reads the previous day as well, so that day's ads still up are seen;
        # the counts start the day after, the first day the stream sees whole.
        start = datetime.combine(until.date() - timedelta(days=1), datetime.min.time())
        complete_from = until.date()
    keep_from = max(complete_from, after_archives).isoformat()
    seen = known_ids()
    http = rawstore.session()
    while start < until:
        end = min(start + WINDOW, until)
        items = fetch_window(http, start, end)
        fetched = datetime.now(timezone.utc).isoformat(timespec="seconds")
        new = [row(ad, fetched) for ad in items
               if not ad.get("removed") and ad.get("publication_date")
               and ad["publication_date"][:10] >= keep_from
               and str(ad["id"]) not in seen]
        seen.update(r["id"] for r in new)
        if new:
            pq.write_table(pa.Table.from_pylist(new, schema=AD_SCHEMA),
                           STREAM / "ads" / f"{start:%Y-%m-%dT%H%M}.parquet",
                           compression="zstd")
        removed = sum(1 for ad in items if ad.get("removed"))
        print(f"{start:%Y-%m-%d %H:%M} to {end:%Y-%m-%d %H:%M}: {len(items):,} changes, "
              f"{len(new):,} new ads, {removed:,} removed", flush=True)
        start = end
        STATE.write_text(json.dumps({"complete_from": complete_from.isoformat(),
                                     "fetched_until": start.strftime(STAMP)}, indent=2) + "\n")
    # A day is complete once the stream has been read past its end.
    last_day = start.date() - timedelta(days=1)
    stats = recount(complete_from, last_day)
    (MARKET / "manifest_stream.json").write_text(json.dumps({
        "archive": "stream", "source_url": STREAM_URL, **stats,
        "complete_from": complete_from.isoformat(), "last_complete_day": last_day.isoformat(),
        "fetched_until": start.strftime(STAMP),
        "counted_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }, indent=2) + "\n")
    print(f"stream: {stats['ads']:,} ads since {complete_from}; complete days "
          f"{complete_from} to {last_day}", flush=True)


if __name__ == "__main__":
    main()
