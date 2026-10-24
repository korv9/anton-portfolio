"""Bring the Worker's profile records up to date, before each hourly match.

    python platform/job_assistant/sync.py

1. A draft the owner asked to approve is checked against the text of its own CV file
   (cv_profile.problems). If it holds, it is stored as the next version; if not, the draft keeps
   its problems so the owner can correct them. A CV uploaded meanwhile waits for the next run, so
   a new upload never drops a pending approval.
2. A CV uploaded since the draft was made is parsed (cv.py) into a new draft; the owner's wishes
   carry over, every CV fact comes from the new file.

The draft, the uploaded CV files and every write need JOB_ASSIST_TOKEN from JOB_ASSIST_API.
Without storage (503) or without the token it changes nothing and says so.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from cv import parse, read_text  # noqa: E402
from cv_profile import approve, problems  # noqa: E402

API = os.environ.get("JOB_ASSIST_API", "https://antonernstsson.com/api/jobs")


def sync(http, token: str) -> str:
    if not token:
        return "no JOB_ASSIST_TOKEN; nothing written"
    headers = {"Authorization": "Bearer " + token}
    profile = http.get(API + "/profile", headers=headers, timeout=30)
    if profile.status_code == 503:
        return "storage is not configured"
    profile.raise_for_status()
    state = profile.json()
    listing = http.get(API + "/cv", headers=headers, timeout=30)
    listing.raise_for_status()
    files = listing.json()["files"]
    draft = state.get("draft")
    current = draft["profile"] if draft else None

    def put_draft(p: dict, found: list[str]) -> None:
        body = {"profile": p, "approval_requested": False, "problems": found}
        http.put(API + "/profile/draft", json=body, headers=headers, timeout=30).raise_for_status()

    def cv_bytes(sha: str) -> bytes:
        response = http.get(f"{API}/cv/{sha}", headers=headers, timeout=60)
        response.raise_for_status()
        return response.content

    latest = files[-1] if files else None
    newer = latest and (current is None or current["cv"]["sha256"] != latest["sha256"])
    if draft and draft.get("approval_requested"):
        media = next((f["media_type"] for f in files if f["sha256"] == current["cv"]["sha256"]), current["cv"]["media_type"])
        text = read_text(cv_bytes(current["cv"]["sha256"]), media)
        try:
            approved = approve(current, text, [state["approved"]] if state.get("approved") else [])
        except ValueError as error:
            put_draft(current, problems(current, text) or [str(error)])
            return f"approval refused: {error}" + (f"; {latest['filename']} is parsed next run" if newer else "")
        http.post(API + "/profile/versions", json=approved, headers=headers, timeout=30).raise_for_status()
        put_draft(current, [])
        return f"approved version {approved['version']}" + (f"; {latest['filename']} is parsed next run" if newer else "")
    if newer:
        data = cv_bytes(latest["sha256"])
        new = parse(data, latest["media_type"], latest["filename"])
        if current:
            new["wishes"] = current["wishes"]
        put_draft(new, problems(new, read_text(data, latest["media_type"])))
        return f"parsed {latest['filename']} into a new draft"
    return "nothing to do"


def main() -> None:
    import requests
    print(sync(requests.Session(), os.environ.get("JOB_ASSIST_TOKEN", "").strip()))


if __name__ == "__main__":
    main()
