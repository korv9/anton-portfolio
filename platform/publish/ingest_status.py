"""Record how a subject's ingestion went, for the tech panel: status/ingestion.json.

platform/pipeline.py calls record() after a subject's ingest steps, whether they succeeded or
failed. The file holds one entry per subject: when it ran, the outcome and its error, the
GitHub run, and per raw source what the fetch log (raw/<source>/_manifest.jsonl) says, with the
fetches, changes and failed requests of this run. The sources are the first segment of the
subject's `raw` paths in pipeline.yml, plus its `sources` key for logs kept outside R2 (news).

The file is written to frontend/public/data/status/ (git-ignored, read by the dev server) and,
in GitHub Actions with R2 credentials, merged into the uncached copy in object storage, outside
any release, so a run that publishes nothing still shows that it ran.
"""
from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))

import rawstore  # noqa: E402
from common import PUBLIC  # noqa: E402

KEY = "status/ingestion.json"
LOCAL = PUBLIC / KEY
CREDENTIALS = ("R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET")


def sources(subject: dict) -> list[str]:
    return list(dict.fromkeys([p.split("/")[0] for p in subject.get("raw", [])]
                              + subject.get("sources", [])))


def entry(subject: dict, started: str, error: str | None) -> dict:
    server, repository, run = (os.environ.get(k) for k in
                               ("GITHUB_SERVER_URL", "GITHUB_REPOSITORY", "GITHUB_RUN_ID"))
    return {
        "recorded_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "started_at": started,
        "outcome": "failure" if error else "success",
        "error": error,
        "github_run": f"{server}/{repository}/actions/runs/{run}" if run else None,
        "sources": [rawstore.fetch_summary(s, since=started) for s in sources(subject)],
    }


def merged(current: bytes | None, name: str, value: dict) -> dict:
    try:
        status = json.loads(current) if current else {}
    except ValueError:
        status = {}
    return {"subjects": {**status.get("subjects", {}), name: value}}


def record(name: str, subject: dict, started: str, error: str | None) -> None:
    value = entry(subject, started, error)
    LOCAL.parent.mkdir(parents=True, exist_ok=True)
    local = merged(LOCAL.read_bytes() if LOCAL.is_file() else None, name, value)
    LOCAL.write_text(json.dumps(local, indent=1) + "\n", encoding="utf-8")
    if os.environ.get("GITHUB_ACTIONS") != "true" or not all(os.environ.get(k) for k in CREDENTIALS):
        return
    from upload import client
    s3, bucket = client()
    try:
        current = s3.get_object(Bucket=bucket, Key=KEY)["Body"].read()
    except s3.exceptions.NoSuchKey:
        current = None
    # Read-modify-write is safe: the data workflows share the concurrency group data-refresh.
    body = json.dumps(merged(current, name, value), indent=1).encode()
    s3.put_object(Bucket=bucket, Key=KEY, Body=body, ContentType="application/json",
                  CacheControl="no-cache, max-age=0")
    print(f"  recorded ingestion of {name} in {KEY}")


if __name__ == "__main__":
    # Self-check: a store line, a feed line with an error, a checkpoint and a torn final line.
    import tempfile
    with tempfile.TemporaryDirectory() as temp:
        rawstore.RAW = Path(temp)
        (rawstore.RAW / "a").mkdir()
        (rawstore.RAW / "a/_manifest.jsonl").write_text("\n".join(json.dumps(r) for r in [
            {"path": "x.json", "fetched_at": "2026-01-01T00:00:00+00:00", "bytes": 5, "changed": True},
            {"path": "x.json", "fetched_at": "2026-02-01T00:00:00+00:00", "bytes": 6, "changed": False},
            {"path": "_checkpoints/g.json", "fetched_at": "2026-03-01T00:00:00+00:00", "bytes": 1},
            {"source": "feed", "fetched_at": "2026-02-01T00:00:00+00:00", "error": "HTTP 503"},
        ]) + '\n{"path": "y')
        got = entry({"raw": ["a/sub", "a/_manifest.jsonl"], "sources": ["missing"]},
                    "2026-01-15T00:00:00+00:00", None)["sources"]
        assert got[0] == {"source_key": "a", "fetched_at": "2026-02-01T00:00:00+00:00",
                          "content_changed_at": "2026-01-01T00:00:00+00:00", "files": 2,
                          "bytes": 6, "fetched": 2, "changed": 0, "errors": 1}, got[0]
        assert got[1] == {"source_key": "missing", "fetched_at": None}
        assert merged(b'{"subjects": {"b": 1}}', "a", {"n": 2}) == {"subjects": {"b": 1, "a": {"n": 2}}}
        assert merged(b"torn", "a", {}) == {"subjects": {"a": {}}}
    print("ok")
