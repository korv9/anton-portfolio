"""Restore the active R2 releases into a local data root: every file the site serves, verified.

    python src/portfolio/publish/restore.py [ROOT] [--group NAME ...] [--skip-group NAME ...]

The site reads its data from the active releases in R2 (manifests/current.json); none of it is in
Git. A workflow restores them into frontend/public/data before it builds, tests or exports, so
the root holds the approved files and a run's exports overwrite only their own. Publishing one
subject then keeps the other subjects of its group as they are (platform/pipeline.py, publish).

The reads go to the bucket's public address, so they need no credentials and work the same
locally, in CI and in the data workflows. Every file is checked against the size and SHA-256 of
its group manifest, and each group manifest against its pointer, so a wrong byte fails the
restore instead of reaching a test or a release. A local file that already matches is kept.
Standard library only: CI's site job runs it before any Python package is installed.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path, PurePosixPath

BASE = (os.environ.get("R2_PUBLIC_BASE") or "https://data.antonernstsson.com/").rstrip("/") + "/"
ROOT = Path(__file__).resolve().parents[3] / "frontend" / "public" / "data"
RELEASE = re.compile(r"[0-9a-f]{64}")


def fetch(key: str, fresh: bool = False) -> bytes:
    # The edge caches manifests/current.json for hours; a unique query string reads the bucket.
    url = BASE + key + (f"?restore={time.time_ns()}" if fresh else "")
    request = urllib.request.Request(url, headers={"User-Agent": "anton-portfolio-restore"})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                return response.read()
        except OSError:
            if attempt == 3:
                raise
            time.sleep(2 ** attempt)
    raise AssertionError("unreachable")


def checked(data: bytes, entry: dict, what: str) -> bytes:
    if len(data) != entry["bytes"] or hashlib.sha256(data).hexdigest() != entry["sha256"]:
        raise ValueError(f"{what} differs from its manifest ({entry['key']})")
    return data


def active_files(groups: list[str] | None = None, skip: list[str] | None = None) -> dict[str, dict]:
    """{logical path: {key, bytes, sha256}} for every file of the active releases."""
    current = json.loads(fetch("manifests/current.json", fresh=True))
    if current.get("schema_version") != 2:
        raise ValueError("Unsupported active manifest")
    if unknown := sorted(set(groups or []) - set(current["groups"])):
        raise ValueError(f"Not active: {', '.join(unknown)}")
    files: dict[str, dict] = {}
    for name, pointer in current["groups"].items():
        if (groups and name not in groups) or name in (skip or []):
            continue
        if not RELEASE.fullmatch(pointer["release"]):
            raise ValueError(f"Invalid release of {name}")
        manifest = json.loads(checked(fetch(pointer["key"]), pointer, f"{name} manifest"))
        for path, entry in manifest["files"].items():
            parts = PurePosixPath(path).parts
            if (path.startswith("/") or any(p in ("", ".", "..") for p in parts) or "\\" in path
                    or entry["key"] != f"releases/{name}/{pointer['release']}/files/{path}"):
                raise ValueError(f"Invalid delivered path in {name}: {path}")
            files[path] = entry
    return files


def restore(root: Path = ROOT, groups: list[str] | None = None, skip: list[str] | None = None) -> dict:
    files = active_files(groups, skip)

    def one(item: tuple[str, dict]) -> int:
        path, entry = item
        target = root / path
        if target.is_file() and hashlib.sha256(target.read_bytes()).hexdigest() == entry["sha256"]:
            return 0
        data = checked(fetch(entry["key"]), entry, path)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        return 1

    # ponytail: 16 threads over ~7,000 small objects; ranged or batched reads if it grows past minutes.
    with ThreadPoolExecutor(max_workers=16) as pool:
        written = sum(pool.map(one, files.items()))
    return {"files": len(files), "written": written, "kept": len(files) - written}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("root", nargs="?", type=Path, default=ROOT)
    parser.add_argument("--group", action="append", help="only this active group (repeatable)")
    parser.add_argument("--skip-group", action="append", help="every active group but this one (repeatable)")
    args = parser.parse_args()
    started = time.monotonic()
    result = restore(args.root.resolve(), args.group, args.skip_group)
    print(json.dumps({**result, "seconds": round(time.monotonic() - started, 1)}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
