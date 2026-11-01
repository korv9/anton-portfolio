"""Compare each subject's last successful ingestion and its group's active release with its
sla.fresh_within, for .github/workflows/data-heartbeat.yml.

    python platform/publish/heartbeat.py                       # the published files
    python platform/publish/heartbeat.py --status status.json  # a local copy, ingestion only
    python platform/publish/heartbeat.py --status status.json --current current.json

The status is status/ingestion.json (platform/publish/ingest_status.py) from the public bucket:
R2_PUBLIC_BASE when set, else the object-storage base in frontend/public/data/delivery.json.
Only subjects with ingest steps are recorded there. manifests/current.json, from the same base,
gives each group's active release, so a subject that only builds is checked as well, and one that
ingests but no longer publishes is caught. A release with unchanged bytes keeps its publication
time, so a group whose data did not change within the SLA reads as stale. A manual subject
(fresh_within: none) is never checked. Prints a Markdown list of the stale subjects, empty when all are
fresh, and exits 0 either way: the workflow opens, updates or closes the issue.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
KEY = "status/ingestion.json"
CURRENT = "manifests/current.json"


def duration(text: str) -> timedelta:
    match = re.fullmatch(r"(\d+)([hd])", text)
    if not match:
        raise ValueError(f"fresh_within must be <n>h or <n>d, got {text!r}")
    return timedelta(hours=int(match[1]) * (24 if match[2] == "d" else 1))


def last_success(entry: dict) -> str | None:
    """When the subject last ingested successfully; older status files carry only the last run."""
    if entry.get("outcome") == "success":
        return entry.get("recorded_at")
    return entry.get("last_success_at")


def stale(subjects: dict, status: dict, now: datetime, current: dict | None = None) -> dict[str, str]:
    """Subject name -> why it is stale, for every checked subject past its SLA. current is
    manifests/current.json; without it only ingestion is compared."""
    recorded = status.get("subjects", {})
    found = {}
    for name, subject in subjects.items():
        within = subject["sla"]["fresh_within"]
        if within == "none":
            continue
        if any("ingest" in step for step in subject["steps"]):
            since = last_success(recorded.get(name) or {})
            if not since:
                found[name] = "no successful ingestion recorded"
            elif now - datetime.fromisoformat(since) > duration(within):
                found[name] = f"last successful ingestion {since}, older than {within}"
        group = subject.get("group")
        if name in found or current is None or not group:
            continue
        since = (current.get("groups", {}).get(group) or {}).get("published_at")
        if not since:
            found[name] = f"group {group} has no active release"
        elif now - datetime.fromisoformat(since) > duration(within):
            found[name] = f"group {group}: active release published {since}, older than {within}"
    return found


def published(key: str) -> dict:
    url = base_url() + "/" + key
    # r2.dev answers 403 to urllib's default User-Agent.
    headers = {"Cache-Control": "no-cache", "User-Agent": "anton-portfolio-heartbeat"}
    with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=30) as response:
        value = json.load(response)
    print(f"read {url}", file=sys.stderr)
    return value


def base_url() -> str:
    base = os.environ.get("R2_PUBLIC_BASE", "").strip()
    if not base:
        delivery = json.loads((ROOT / "frontend/public/data/delivery.json").read_text(encoding="utf-8"))
        base = delivery["bases"]["shard"]
    return base.rstrip("/")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--status", type=Path, help="A local status file instead of the published one")
    parser.add_argument("--current", type=Path, help="A local manifests/current.json, with --status")
    args = parser.parse_args()
    import yaml
    subjects = yaml.safe_load((ROOT / "platform/pipeline.yml").read_text(encoding="utf-8"))["subjects"]
    if args.status:
        status = json.loads(args.status.read_text(encoding="utf-8"))
        current = json.loads(args.current.read_text(encoding="utf-8")) if args.current else None
    else:
        status, current = published(KEY), published(CURRENT)
    for name, reason in stale(subjects, status, datetime.now(timezone.utc), current).items():
        print(f"- `{name}`: {reason}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
