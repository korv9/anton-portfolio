"""Keep the job assistant's Data/IT ads current from JobTech's JobStream, once an hour.

    python platform/job_assistant/ads.py [--until 2026-10-23T14:00]

The first run reads every current Data/IT ad from JobSearch, one publication day at a time over the
last 60 days (JobStream's snapshot ignores the occupation filter). An ad published earlier and still
open is missed until it changes, when the stream brings it in; later runs ask the stream for
every change since the stored cursor, in windows of at most six hours. Each answer is kept as
served, with its provenance line (src/portfolio/storage/rawstore.py), under warehouse/raw/job_assistant/. The store:

    ads.json     a JSON array, one row per JobTech ad id: headline, employer, place, full public text, source
                 links, dates, content hash, removed time, duplicate group and change history
    state.json   the cursor: the local time fetched up to
    runs.jsonl   one row per run: windows, counts and outcome

A changed ad replaces its row only when its content hash differs; the old hash goes to its history.
A removed ad keeps its row with `removed_at`, so the owner's status still points at something.
ads.json is written atomically before the cursor moves, so a run stopped halfway asks for the same
window again, and the id plus hash rule makes the repeat harmless.

Each run starts `overlap` before the stored cursor (JOB_STREAM_OVERLAP_MINUTES, default 10 on the
command line), so an event JobStream indexes late is still read. An event is applied only when its
source time (the ad's `timestamp`, or `removed_date`) is not older than the one stored in
`source_updated`, so a repeated or late answer never undoes a newer state. JobStream allows one
request a minute: windows after the first wait `SPACING`. An answer that is not a JSON list is an
error and stops the run before the cursor moves; an empty list is a valid answer with no changes.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "ingest/jobtech"))
from portfolio.core.io import write_json  # noqa: E402
from portfolio.storage import rawstore  # noqa: E402
from ingest_jobs import API as SEARCH_URL, fetch_search  # noqa: E402
from publish.job_content import public_text, public_url, redact  # noqa: E402

SOURCE = "job_assistant"
STREAM_URL = "https://jobstream.api.jobtechdev.se"
IT_FIELD = "apaJ_2ja_LuF"  # Data/IT, as in ingest/jobtech/weekly_jobs.py
LOCAL = ZoneInfo("Europe/Stockholm")
WINDOW = timedelta(hours=6)
STAMP = "%Y-%m-%dT%H:%M:%S"
ATTEMPTS = 4
BOOTSTRAP_DAYS = 60
SPACING = 61  # seconds between JobStream requests; its rate limit is one a minute
pause = time.sleep


def store_dir() -> Path:
    return rawstore.RAW / SOURCE


def write_atomic(path: Path, value: object) -> None:
    write_json(path, value, indent=1, sort_keys=True, atomic=True)


def load_ads(path: Path) -> dict:
    """The store by ad id; on disk it is a JSON array sorted by id, so dbt reads one row per ad."""
    return {r["id"]: r for r in json.loads(path.read_text(encoding="utf-8"))} if path.exists() else {}


def save_ads(path: Path, ads: dict) -> None:
    write_atomic(path, [ads[k] for k in sorted(ads)])


def fold(text: str) -> str:
    return " ".join((text or "").split()).casefold()


def project(ad: dict, seen: str) -> dict:
    """The public row of one JobStream ad: what the review list shows, nothing else."""
    text, origin, redactions = public_text(ad)
    place = ad.get("workplace_address") or {}
    employer = ad.get("employer") or {}
    row = {
        "id": str(ad["id"]),
        "headline": ad.get("headline") or "",
        "employer": employer.get("name") or employer.get("workplace") or "",
        "organisation_number": employer.get("organization_number"),
        "municipality": place.get("municipality"),
        "region": place.get("region"),
        "country_code": place.get("country_code"),
        "occupation": (ad.get("occupation") or {}).get("label"),
        "employment_type": (ad.get("employment_type") or {}).get("label"),
        "working_hours": (ad.get("working_hours_type") or {}).get("label"),
        "description": text,
        "text_origin": origin,
        "contact_redactions": redactions,
        "must_have": [s.get("label") for s in (ad.get("must_have") or {}).get("skills") or [] if s.get("label")],
        "nice_to_have": [s.get("label") for s in (ad.get("nice_to_have") or {}).get("skills") or [] if s.get("label")],
        "source_url": public_url(ad.get("webpage_url")) or f"https://arbetsformedlingen.se/platsbanken/annonser/{ad['id']}",
        "application_url": public_url((ad.get("application_details") or {}).get("url")),
        "application_deadline": ad.get("application_deadline"),
        "published": ad.get("publication_date"),
        "changed": ad.get("timestamp") and datetime.fromtimestamp(ad["timestamp"] / 1000, LOCAL).strftime(STAMP),
    }
    hashes(row)
    row["first_seen"] = seen
    return row


def hashes(row: dict) -> None:
    """Set the content hash (what the review list shows) and the duplicate key of a public row."""
    shown = {k: row[k] for k in ("headline", "employer", "municipality", "region", "description",
                                 "application_deadline", "employment_type", "working_hours",
                                 "must_have", "nice_to_have", "application_url")}
    row["content_hash"] = hashlib.sha256(json.dumps(shown, ensure_ascii=False, sort_keys=True).encode()).hexdigest()
    row["duplicate_key"] = hashlib.sha256(
        "\n".join(map(fold, (row["employer"], row["headline"], row["description"]))).encode()).hexdigest()


def reredact(ads: dict) -> int:
    """Apply the current e-mail and phone redaction to stored texts; returns how many rows changed.

    A wider pattern (job_content.PHONE) then also covers ads stored before it, without a refetch.
    """
    changed = 0
    for row in ads.values():
        text, n = redact(row.get("description") or "")
        if n:
            row.update(description=text, contact_redactions=(row.get("contact_redactions") or 0) + n)
            hashes(row)
            changed += 1
    return changed


def source_time(ad: dict) -> str | None:
    """When the source changed this ad, as a local STAMP: removed_date, or the ad's timestamp."""
    if ad.get("removed"):
        return (ad.get("removed_date") or "")[:19] or None
    return ad.get("timestamp") and datetime.fromtimestamp(ad["timestamp"] / 1000, LOCAL).strftime(STAMP)


def apply(ads: dict, items: list[dict], seen: str) -> dict:
    """Fold one JobStream answer into the store; returns counts. Repeating an answer changes nothing,
    and an event older than the stored state of its ad is counted as stale and skipped."""
    counts = {"new": 0, "changed": 0, "removed": 0, "unchanged": 0, "other_field": 0, "stale": 0}
    times = []  # source times of the events that changed the store, for the latency measure
    for ad in items:
        field = ad.get("occupation_field")
        field = field.get("concept_id") if isinstance(field, dict) else field
        key = str(ad["id"])
        old = ads.get(key)
        at = source_time(ad)
        if old and at and at < (old.get("source_updated") or old.get("changed") or ""):
            counts["stale"] += 1
            continue
        if old and at:
            old["source_updated"] = at
        if field not in (None, IT_FIELD):
            # An ad moved out of Data/IT is no longer current here; without removed_at it would stay forever.
            if old and not old.get("removed_at"):
                old["removed_at"] = seen
                old["history"].append({"at": seen, "event": "left_field"})
                counts["removed"] += 1
                times.append(at)
            counts["other_field"] += 1
            continue
        if ad.get("removed"):
            if old and not old.get("removed_at"):
                old["removed_at"] = ad.get("removed_date") or seen
                old["history"].append({"at": seen, "event": "removed"})
                counts["removed"] += 1
                times.append(at)
            continue
        row = project(ad, seen)
        row["source_updated"] = at
        if old is None:
            ads[key] = {**row, "removed_at": None, "history": [{"at": seen, "event": "new", "hash": row["content_hash"]}]}
            counts["new"] += 1
            times.append(at)
        elif old["content_hash"] != row["content_hash"] or old.get("removed_at"):
            history = old["history"] + [{"at": seen, "event": "changed", "hash": row["content_hash"]}]
            ads[key] = {**row, "first_seen": old["first_seen"], "removed_at": None, "history": history}
            counts["changed"] += 1
            times.append(at)
        else:
            counts["unchanged"] += 1
    times = sorted(t for t in times if t)
    if times:
        counts["earliest"], counts["latest"] = times[0], times[-1]
    return counts


def duplicates(ads: dict) -> None:
    """Rows with the same employer, headline and text under several ids point at the lowest id."""
    first: dict[str, str] = {}
    for key in sorted(ads, key=lambda k: (len(k), k)):
        row = ads[key]
        if row.get("removed_at"):
            row["duplicate_of"] = None
            continue
        row["duplicate_of"] = first.setdefault(row["duplicate_key"], key)
        if row["duplicate_of"] == key:
            row["duplicate_of"] = None


def fetch(http, path: str, params: dict, name: str) -> list[dict]:
    url = f"{STREAM_URL}/{path}?" + "&".join(f"{k}={v}" for k, v in params.items())
    for attempt in range(1, ATTEMPTS + 1):
        # rawstore.session() already retries 429 and 5xx with backoff; what still fails is raised.
        try:
            response = http.get(url, timeout=900)
            response.raise_for_status()
        except Exception as error:
            rawstore.record_error(SOURCE, f"raw/{name}.json.gz", url, error)
            raise
        try:
            items = json.loads(response.content)
        except json.JSONDecodeError:
            if attempt == ATTEMPTS:
                raise
            time.sleep(10 * attempt)
            continue
        if not isinstance(items, list):
            # A 200 with an error object is not "no changes": stop before the cursor moves.
            raise ValueError(f"{name}: JobStream answered {type(items).__name__}, not a list")
        rawstore.store(SOURCE, f"raw/{name}.json.gz", response.content, url=url)
        return items
    raise AssertionError("unreachable")


def bootstrap(http, until: datetime) -> list[dict]:
    """Every current Data/IT ad, from JobSearch one publication day at a time (JobStream's snapshot
    ignores the occupation filter and returns the whole country)."""
    found = []
    for day in range(BOOTSTRAP_DAYS, -1, -1):
        lo = datetime.combine((until - timedelta(days=day)).date(), datetime.min.time())
        hi = min(lo + timedelta(days=1), until)
        params = {"occupation-field": IT_FIELD, "published-after": lo.strftime(STAMP),
                  "published-before": hi.strftime(STAMP), "sort": "pubdate-asc"}
        pages = []

        def observe(response, query, pages=pages):
            pages.append(response.content)
            rawstore.store(SOURCE, f"raw/search-{lo:%Y-%m-%d}-{len(pages)}.json", response.content,
                           url=SEARCH_URL + "?" + "&".join(f"{k}={v}" for k, v in query.items()))

        ads, coverage = fetch_search(http, params, 20, observe=observe, sleep=pause)
        if not coverage["complete"]:
            raise ValueError(f"JobSearch day {lo:%Y-%m-%d} was not read completely: {coverage}")
        found.extend(ads)
    return found


def run(until: datetime, http=None, now=None, overlap: timedelta = timedelta(0)) -> dict:
    """Bring the store up to `until` (Stockholm local time, naive), reading from `overlap` before the
    cursor. Returns this run's record."""
    now = now or (lambda: datetime.now(timezone.utc).isoformat(timespec="seconds"))
    http = http or rawstore.session()
    folder = store_dir()
    ads_path, state_path = folder / "ads.json", folder / "state.json"
    ads = load_ads(ads_path)
    state = json.loads(state_path.read_text(encoding="utf-8")) if state_path.exists() else {}
    record = {"started": now(), "windows": [], "outcome": "running"}
    try:
        record["re_redacted"] = reredact(ads)
        if record["re_redacted"]:
            duplicates(ads)
            save_ads(ads_path, ads)
        if not state:
            # The search has no cursor of its own: the stream starts a little before it was asked.
            start = until - timedelta(minutes=10)
            items = bootstrap(http, until)
            counts = apply(ads, items, now())
            duplicates(ads)
            save_ads(ads_path, ads)
            write_atomic(state_path, {"fetched_until": start.strftime(STAMP)})
            record["windows"].append({"snapshot": until.strftime(STAMP), **counts})
            state = {"fetched_until": start.strftime(STAMP)}
        cursor = datetime.strptime(state["fetched_until"], STAMP)
        start = cursor - overlap
        while start < until:
            if record["windows"] and "from" in record["windows"][-1]:
                pause(SPACING)
            end = min(start + WINDOW, until)
            params = {"date": start.strftime(STAMP), "updated-before-date": end.strftime(STAMP),
                      "occupation-concept-id": IT_FIELD}
            items = fetch(http, "stream", params, f"stream-{start:%Y-%m-%dT%H%M}")
            counts = apply(ads, items, now())
            duplicates(ads)
            save_ads(ads_path, ads)
            # The overlap reads behind the cursor; the cursor itself never moves back.
            cursor = max(cursor, end)
            write_atomic(state_path, {"fetched_until": cursor.strftime(STAMP)})
            record["windows"].append({"from": start.strftime(STAMP), "to": end.strftime(STAMP),
                                      "items": len(items), **counts})
            start = end
        record["outcome"] = "ok"
    except Exception as error:
        record["outcome"] = f"failed: {type(error).__name__}: {str(error)[:200]}"
        raise
    finally:
        record["finished"] = now()
        record["ads"] = len(ads)
        record["current"] = sum(1 for r in ads.values() if not r.get("removed_at"))
        folder.mkdir(parents=True, exist_ok=True)
        with (folder / "runs.jsonl").open("a", encoding="utf-8", newline="\n") as out:
            out.write(json.dumps(record, ensure_ascii=False) + "\n")
    return record


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--until", help="Stockholm local time to fetch up to (default: five minutes ago)")
    args = ap.parse_args()
    until = (datetime.strptime(args.until, "%Y-%m-%dT%H:%M") if args.until
             else datetime.now(LOCAL).replace(tzinfo=None, second=0, microsecond=0) - timedelta(minutes=5))
    record = run(until, overlap=timedelta(minutes=int(os.environ.get("JOB_STREAM_OVERLAP_MINUTES", "10"))))
    print(json.dumps({k: record[k] for k in ("outcome", "ads", "current")}), len(record["windows"]), "windows")


if __name__ == "__main__":
    main()
