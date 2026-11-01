"""What a result was computed from: task code, data content and the commit.

A cache key built from row counts and settings survives a changed title or a changed metric, so
it can hand back a result the current code and data would not produce. Digests go into the key.
The commit does not, or every commit would invalidate every job; it goes on the card.
"""
from __future__ import annotations

import hashlib
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SHARED = ("data.py", "metrics.py", "splits.py")


def code_digest(task_file: str | Path) -> str:
    """The task's source and the shared modules it scores with, with line endings normalised."""
    here = Path(__file__).parent
    digest = hashlib.sha256()
    for path in [Path(task_file), *(here / name for name in SHARED)]:
        digest.update(path.read_bytes().replace(b"\r\n", b"\n"))
    return digest.hexdigest()[:16]


def data_digest(rows) -> str:
    digest = hashlib.sha256()
    for row in rows:
        digest.update(json.dumps(row, sort_keys=True, ensure_ascii=False, default=str).encode())
    return digest.hexdigest()[:16]


def stamp(inputs: dict, task_file: str | Path, rows) -> dict:
    """`inputs` with both digests added, ready to be hashed into the cache key."""
    return {**inputs, "code_sha256": code_digest(task_file), "data_sha256": data_digest(rows)}


def git_sha() -> str:
    """HEAD, marked dirty when `ml/` differs from it, or 'unknown' outside a checkout."""
    try:
        run = lambda *args: subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True,
                                           check=True).stdout.strip()
        return run("rev-parse", "HEAD") + ("-dirty" if run("status", "--porcelain", "--", "ml") else "")
    except (OSError, subprocess.CalledProcessError):
        return "unknown"


def card_fields(inputs: dict) -> dict:
    return {"code digest": inputs.get("code_sha256", "not recorded"),
            "data digest": inputs.get("data_sha256", "not recorded"), "git commit": git_sha()}
