"""Snapshot the GitHub facts the platform page shows: status/github.json.

The page (frontend/src/tech/github.ts) used to ask the GitHub API itself, about 35 unsigned
requests a view against a limit of 60 an hour per address, so visitors saw 403s. This script
asks once with the workflow's token and writes what the page reads:

  workflows       every workflow under .github/workflows with its 14 newest runs
  scheduled_runs  the scheduled runs of the last 30 days (at most 100, newest first) and the total
  failure_issues  issues labelled data-pipeline-failure touched in the same window
  incidents       the postmortems in docs/incidents
  fabric_demo     the replay log in korv9/diva-fabric-lakehouse docs/demo.md

    GH_TOKEN=... python platform/publish/github_status.py   # writes frontend/public/data/status/

In GitHub Actions with R2 credentials it also puts the file in object storage, uncached and
outside any release, like status/ingestion.json (ingest_status.py).
"""
from __future__ import annotations

import base64
import json
import os
import sys
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))

from common import PUBLIC  # noqa: E402

KEY = "status/github.json"
LOCAL = PUBLIC / KEY
REPO = os.environ.get("GITHUB_REPOSITORY", "korv9/anton-portfolio")
LAKEHOUSE = "korv9/diva-fabric-lakehouse"
DAYS = 30
CREDENTIALS = ("R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET")
RUN_FIELDS = ("id", "name", "status", "conclusion", "event", "created_at", "run_started_at",
              "updated_at", "html_url", "head_sha", "head_branch")
ISSUE_FIELDS = ("number", "title", "html_url", "body", "created_at", "closed_at")


def api(path: str):
    request = urllib.request.Request(
        f"https://api.github.com/repos/{path}",
        headers={"Accept": "application/vnd.github+json",
                 "Authorization": f"Bearer {os.environ['GH_TOKEN']}"})
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


def pick(record: dict, fields: tuple[str, ...]) -> dict:
    return {f: record.get(f) for f in fields}


def snapshot(now: datetime) -> dict:
    since = (now - timedelta(days=DAYS)).date().isoformat()
    workflows = [
        {"id": w["id"], "name": w["name"], "path": w["path"],
         "runs": [pick(r, RUN_FIELDS) for r in
                  api(f"{REPO}/actions/workflows/{w['id']}/runs?per_page=14")["workflow_runs"]]}
        for w in api(f"{REPO}/actions/workflows")["workflows"]
        if w["path"].startswith(".github/workflows/")
    ]
    scheduled = api(f"{REPO}/actions/runs?event=schedule&created=>={since}&per_page=100")
    issues = api(f"{REPO}/issues?labels=data-pipeline-failure&state=all"
                 f"&since={since}T00:00:00Z&per_page=100")
    incidents = [{"name": f["name"], "html_url": f["html_url"]}
                 for f in api(f"{REPO}/contents/docs/incidents") if f["name"].endswith(".md")]
    demo = api(f"{LAKEHOUSE}/contents/docs/demo.md")
    return {
        "generated_at": now.isoformat(timespec="seconds"),
        "repository": REPO,
        "workflows": workflows,
        "scheduled_runs": {
            "since": since,
            "total_count": scheduled.get("total_count", len(scheduled["workflow_runs"])),
            "workflow_runs": [pick(r, RUN_FIELDS) for r in scheduled["workflow_runs"]],
        },
        "failure_issues": [pick(i, ISSUE_FIELDS) for i in issues if "pull_request" not in i],
        "incidents": incidents,
        "fabric_demo": base64.b64decode(demo["content"]).decode("utf-8"),
    }


def publish(body: bytes) -> None:
    if os.environ.get("GITHUB_ACTIONS") != "true" or not all(os.environ.get(k) for k in CREDENTIALS):
        return
    from upload import client
    s3, bucket = client()
    s3.put_object(Bucket=bucket, Key=KEY, Body=body, ContentType="application/json",
                  CacheControl="no-cache, max-age=0")
    print(f"  wrote {KEY} to object storage")


if __name__ == "__main__":
    data = snapshot(datetime.now(timezone.utc))
    body = json.dumps(data, indent=1).encode()
    LOCAL.parent.mkdir(parents=True, exist_ok=True)
    LOCAL.write_bytes(body + b"\n")
    print(f"{KEY}: {len(data['workflows'])} workflows, "
          f"{len(data['scheduled_runs']['workflow_runs'])} scheduled runs, "
          f"{len(data['failure_issues'])} failure issues, {len(data['incidents'])} incidents")
    publish(body)
