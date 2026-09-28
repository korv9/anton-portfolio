"""Count every job ad in JobTech's historical archives, for the whole labour market.

    python platform/ingest/jobtech/ingest_market.py                 # every archive from 2020
    python platform/ingest/jobtech/ingest_market.py --archives 2025 2026-Q1
    python platform/ingest/jobtech/ingest_market.py --keep          # keep the downloads

The IT report (ingest_history.py) keeps whole ads, but only for four roles. This keeps no
ads at all: it streams each archive once and counts ads and vacancies, so every occupation
fits in a few megabytes. Per archive, under warehouse/raw/jobtech/market/:

    ads_<archive>.parquet         ads and vacancies per publication month, occupation field,
                                  occupation group (SSYK 4) and county
    conditions_<archive>.parquet  the same per month and occupation field, by employment
                                  type, working hours and whether experience is required
    manifest_<archive>.json       source URL, SHA-256 of the archive, ads read, duplicates

JobTech publishes one archive per year and, for the current year, one per quarter
(https://data.arbetsformedlingen.se/annonser/historiska/). An archive already counted is
skipped without downloading when the server reports the same size and date for it, and
after downloading when the file has the same SHA-256. Labels are kept as the archive writes them; dbt
harmonises the older upper-case codes (2020-2021) with the later labels.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import time
import zipfile
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

import pyarrow as pa
import pyarrow.parquet as pq
import requests

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

try:
    from .ingest_history import download
except ImportError:
    from ingest_history import download

REPO = Path(__file__).resolve().parents[3]
OUT = REPO / "warehouse/raw/jobtech/market"
ARCHIVES = REPO / "warehouse/jobtech/archives"
INDEX = "https://data.arbetsformedlingen.se/annonser/historiska/"
FIRST_YEAR = 2020


def published_archives() -> list[str]:
    """Every archive from FIRST_YEAR in JobTech's listing: '2024', '2026-Q1', ..."""
    html = requests.get(INDEX, timeout=60).text
    names = sorted(set(re.findall(r'historiska/(\d{4}(?:-Q\d)?)\.jsonl\.zip', html)))
    return [n for n in names if int(n[:4]) >= FIRST_YEAR]


def remote_stamp(name: str) -> dict:
    """Size and date of an archive as the server reports them, to skip unchanged files."""
    response = requests.head(f"{INDEX}{name}.jsonl.zip", timeout=60, allow_redirects=True)
    response.raise_for_status()
    return {"content_length": response.headers.get("Content-Length"),
            "last_modified": response.headers.get("Last-Modified")}


def first(value):
    """A taxonomy value is an object, or in some archives a list of them."""
    if isinstance(value, list):
        return next((v for v in value if v), None) or {}
    return value or {}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def count(path: Path) -> tuple[dict, dict, dict]:
    # key -> [ads, vacancies]
    ads: dict = defaultdict(lambda: [0, 0])
    conditions: dict = defaultdict(lambda: [0, 0])
    seen: set[str] = set()
    read = duplicates = 0
    with zipfile.ZipFile(path) as archive:
        name = next(n for n in archive.namelist() if n.endswith(".jsonl"))
        with archive.open(name) as lines:
            for line in lines:
                if not line.strip():
                    continue
                ad = json.loads(line)
                read += 1
                key = str(ad.get("id"))
                if key in seen:
                    duplicates += 1
                    continue
                seen.add(key)
                month = (ad.get("publication_date") or "")[:7]
                vacancies = ad.get("number_of_vacancies")
                vacancies = vacancies if isinstance(vacancies, int) and 0 < vacancies < 1000 else 1
                field = first(ad.get("occupation_field"))
                group = first(ad.get("occupation_group"))
                place = first(ad.get("workplace_address"))
                cell = ads[(month,
                     field.get("concept_id"), field.get("label"),
                     group.get("concept_id"), group.get("legacy_ams_taxonomy_id"),
                     group.get("label"),
                     place.get("region"))]
                cell[0] += 1
                cell[1] += vacancies
                experience = ad.get("experience_required")
                cell = conditions[(month, field.get("concept_id"),
                            first(ad.get("employment_type")).get("label"),
                            first(ad.get("working_hours_type")).get("label"),
                            experience if isinstance(experience, bool) else None)]
                cell[0] += 1
                cell[1] += vacancies
    return ads, conditions, {"ads_read": read, "duplicates": duplicates, "ads": len(seen)}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--archives", nargs="+", help="Default: every published archive from 2020")
    parser.add_argument("--keep", action="store_true", help="Keep the downloaded archives")
    parser.add_argument("--force", action="store_true", help="Count again even if unchanged")
    args = parser.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    for name in args.archives or published_archives():
        started = time.monotonic()
        manifest_path = OUT / f"manifest_{name}.json"
        stamp = remote_stamp(name)
        previous = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
        if previous and not args.force and all(previous.get(k) == v for k, v in stamp.items()):
            print(f"{name}: unchanged on the server, skipped", flush=True)
            continue
        path, url = download(name, ARCHIVES)
        digest = sha256(path)
        if previous and not args.force:
            if previous.get("sha256") == digest:
                manifest_path.write_text(json.dumps({**previous, **stamp}, indent=2) + "\n")
                print(f"{name}: unchanged, skipped", flush=True)
                if not args.keep:
                    path.unlink()
                continue
        ads, conditions, stats = count(path)
        write(ads, ["publication_month", "field_id", "field", "group_id", "ssyk",
                    "occupation_group", "region"], OUT / f"ads_{name}.parquet")
        write(conditions, ["publication_month", "field_id", "employment_type",
                           "working_hours", "experience_required"],
              OUT / f"conditions_{name}.parquet")
        manifest_path.write_text(json.dumps({
            "archive": name, "source_url": url, "sha256": digest, **stamp, **stats,
            "counted_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        }, indent=2) + "\n")
        print(f"{name}: {stats['ads']:,} ads, {len(ads):,} cells, "
              f"{time.monotonic() - started:.0f}s", flush=True)
        if not args.keep:
            path.unlink()


def write(counter: dict, columns: list[str], path: Path) -> None:
    rows = [(*key, n, v) for key, (n, v) in counter.items()]
    table = pa.table({name: [r[i] for r in rows] for i, name in enumerate(columns + ["ads", "vacancies"])})
    pq.write_table(table, path, compression="zstd")


if __name__ == "__main__":
    main()
