"""Keep the job assistant's Data/IT ads current from JobTech's JobStream, once an hour.

    python platform/job_assistant/ads.py [--until 2026-10-23T14:00]

The first run reads every current Data/IT ad from JobSearch, one publication day at a time over the
last 60 days (JobStream's snapshot ignores the occupation filter); later runs ask the stream for
every change since the stored cursor, in windows of at most six hours. Each answer is kept as
served, with its provenance line (lib/rawstore.py), under warehouse/raw/job_assistant/. The store:

    ads.json     one row per JobTech ad id: headline, employer, place, full public text, source
                 links, dates, content hash, removed time, duplicate group and change history
    state.json   the cursor: the local time fetched up to
    runs.jsonl   one row per run: windows, counts and outcome

A changed ad replaces its row only when its content hash differs; the old hash goes to its history.
A removed ad keeps its row with `removed_at`, so the owner's status still points at something.
ads.json is written atomically before the cursor moves, so a run stopped halfway asks for the same
window again, and the id plus hash rule makes the repeat harmless.
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
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "ingest/jobtech"))
import rawstore  # noqa: E402
from ingest_jobs import API as SEARCH_URL, fetch_search  # noqa: E402
from publish.job_content import public_text, public_url  # noqa: E402

SOURCE = "job_assistant"
STREAM_URL = "https://jobstream.api.jobtechdev.se"
IT_FIELD = "apaJ_2ja_LuF"  # Data/IT, as in ingest/jobtech/weekly_jobs.py
LOCAL = ZoneInfo("Europe/Stockholm")
WINDOW = timedelta(hours=6)
STAMP = "%Y-%m-%dT%H:%M:%S"
ATTEMPTS = 4
BOOTSTRAP_DAYS = 60
pause = time.sleep


def store_dir() -> Path:
    return rawstore.RAW / SOURCE


def write_atomic(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(value, ensure_ascii=False, indent=1, sort_keys=True) + "\n",
                   encoding="utf-8", newline="\n")
    os.replace(tmp, path)


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
    shown = {k: row[k] for k in ("headline", "employer", "municipality", "region", "description",
                                 "application_deadline", "employment_type", "working_hours",
                                 "must_have", "nice_to_have", "application_url")}
    row["content_hash"] = hashlib.sha256(json.dumps(shown, ensure_ascii=False, sort_keys=True).encode()).hexdigest()
    row["duplicate_key"] = hashlib.sha256("\n".join(map(fold, (row["employer"], row["headline"], text))).encode()).hexdigest()
    row["first_seen"] = seen
    return row


def apply(ads: dict, items: list[dict], seen: str) -> dict:
    """Fold one JobStream answer into the store; returns counts. Repeating an answer changes nothing."""
    counts = {"new": 0, "changed": 0, "removed": 0, "unchanged": 0, "other_field": 0}
    for ad in items:
        field = (ad.get("occupation_field") or {}).get("concept_id")
        if field not in (None, IT_FIELD):
            counts["other_field"] += 1
            continue
        key = str(ad["id"])
        old = ads.get(key)
        if ad.get("removed"):
            if old and not old.get("removed_at"):
                old["removed_at"] = ad.get("removed_date") or seen
                old["history"].append({"at": old["removed_at"], "event": "removed"})
                counts["removed"] += 1
            continue
        row = project(ad, seen)
        if old is None:
            ads[key] = {**row, "removed_at": None, "history": [{"at": seen, "event": "new", "hash": row["content_hash"]}]}
            counts["new"] += 1
        elif old["content_hash"] != row["content_hash"] or old.get("removed_at"):
            history = old["history"] + [{"at": seen, "event": "changed", "hash": row["content_hash"]}]
            ads[key] = {**row, "first_seen": old["first_seen"], "removed_at": None, "history": history}
            counts["changed"] += 1
        else:
            counts["unchanged"] += 1
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
        response = http.get(url, timeout=900)
        response.raise_for_status()
        try:
            items = json.loads(response.content)
        except json.JSONDecodeError:
            if attempt == ATTEMPTS:
                raise
            time.sleep(10 * attempt)
            continue
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


def run(until: datetime, http=None, now=None) -> dict:
    """Bring the store up to `until` (Stockholm local time, naive). Returns this run's record."""
    now = now or (lambda: datetime.now(timezone.utc).isoformat(timespec="seconds"))
    http = http or rawstore.session()
    folder = store_dir()
    ads_path, state_path = folder / "ads.json", folder / "state.json"
    ads = json.loads(ads_path.read_text(encoding="utf-8")) if ads_path.exists() else {}
    state = json.loads(state_path.read_text(encoding="utf-8")) if state_path.exists() else {}
    record = {"started": now(), "windows": [], "outcome": "running"}
    try:
        if not state:
            # The search has no cursor of its own: the stream starts a little before it was asked.
            start = until - timedelta(minutes=10)
            items = bootstrap(http, until)
            counts = apply(ads, items, now())
            duplicates(ads)
            write_atomic(ads_path, ads)
            write_atomic(state_path, {"fetched_until": start.strftime(STAMP)})
            record["windows"].append({"snapshot": until.strftime(STAMP), **counts})
            state = {"fetched_until": start.strftime(STAMP)}
        start = datetime.strptime(state["fetched_until"], STAMP)
        while start < until:
            end = min(start + WINDOW, until)
            params = {"date": start.strftime(STAMP), "updated-before-date": end.strftime(STAMP),
                      "occupation-concept-id": IT_FIELD}
            items = fetch(http, "stream", params, f"stream-{start:%Y-%m-%dT%H%M}")
            counts = apply(ads, items, now())
            duplicates(ads)
            write_atomic(ads_path, ads)
            write_atomic(state_path, {"fetched_until": end.strftime(STAMP)})
            record["windows"].append({"from": start.strftime(STAMP), "to": end.strftime(STAMP), **counts})
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
    record = run(until)
    print(json.dumps({k: record[k] for k in ("outcome", "ads", "current")}), len(record["windows"]), "windows")


if __name__ == "__main__":
    main()
