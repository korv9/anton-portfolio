"""Delete superseded releases: per active group keep the active release, every release another
manifests/*.json points at, and the N most recent other approved releases (rollback targets).
An approved release has a manifest.json, which is written only after its gate passed. A release
prefix without one is an interrupted upload; it is deleted once all its objects are older than
the safety age. Groups that are not in the active manifest are left alone. Dry run by default."""
from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import release

RELEASE = re.compile(r"[0-9a-f]{64}")


def listing(s3, bucket: str, prefix: str) -> list[dict]:
    return [obj for page in s3.get_paginator("list_objects_v2").paginate(Bucket=bucket, Prefix=prefix)
            for obj in page.get("Contents", [])]


def snapshot(s3, bucket: str, key: str) -> dict[str, str]:
    data, _ = release.read(s3, bucket, key)
    if data is None:
        raise ValueError(f"Cannot read {key}")
    state = release.strict_json(data)
    if state.get("schema_version") != 2:
        raise ValueError(f"Unsupported manifest schema: {key}")
    groups = {group: pointer.get("release") for group, pointer in state["groups"].items()}
    if not all(isinstance(r, str) and RELEASE.fullmatch(r) for r in groups.values()):
        raise ValueError(f"Manifest without full release ids: {key}")
    return groups


def plan(s3, bucket: str, keep: int = 2, min_age: timedelta = timedelta(days=7), now=None) -> dict:
    """{group: {active, kept, deleted, keys}}; raises before any delete when unsure."""
    now = now or datetime.now(timezone.utc)
    active = snapshot(s3, bucket, release.CURRENT)
    protected = {group: {r} for group, r in active.items()}
    # Smoke and bootstrap manifests are activations too; their releases are never deleted.
    for obj in listing(s3, bucket, "manifests/"):
        if obj["Key"].endswith(".json") and obj["Key"] != release.CURRENT:
            for group, r in snapshot(s3, bucket, obj["Key"]).items():
                protected.setdefault(group, set()).add(r)
    result = {}
    for group, current in sorted(active.items()):
        objects = {}
        for obj in listing(s3, bucket, f"releases/{release.name(group)}/"):
            parts = obj["Key"].split("/")
            if len(parts) > 3 and RELEASE.fullmatch(parts[2]):  # Never touch an unknown layout.
                objects.setdefault(parts[2], []).append(obj)
        approved = {r: o["LastModified"] for r, objs in objects.items() for o in objs
                    if o["Key"] == f"releases/{group}/{r}/manifest.json"}
        if current not in approved:
            raise ValueError(f"Active {group} release {current} is not listed; nothing deleted")
        previous = sorted((r for r in approved if r not in protected[group]), key=approved.get, reverse=True)
        kept = protected[group] | set(previous[:keep])
        cutoff = now - min_age
        deleted = sorted(r for r, objs in objects.items() if r not in kept and (
            r in approved or max(o["LastModified"] for o in objs) < cutoff))
        if current in deleted:
            raise ValueError(f"Refusing to delete the active {group} release")
        # Manifests first: an interrupted delete leaves an unapproved prefix, never a broken target.
        keys = sorted((o["Key"] for r in deleted for o in objects[r]),
                      key=lambda k: (not k.endswith("/manifest.json"), k))
        result[group] = {"active": current, "kept": sorted(kept & objects.keys()),
                         "deleted": deleted, "keys": keys}
    return result


def delete(s3, bucket: str, keys: list[str]):
    for start in range(0, len(keys), 1000):
        batch = [{"Key": key} for key in keys[start:start + 1000]]
        errors = s3.delete_objects(Bucket=bucket, Delete={"Objects": batch, "Quiet": True}).get("Errors")
        if errors:
            raise RuntimeError(f"{len(errors)} deletions failed, first {errors[0].get('Key')}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--keep", type=int, default=2, help="previous approved releases kept per group")
    parser.add_argument("--min-age-days", type=float, default=7,
                        help="an unapproved (interrupted) release is deleted only when older than this")
    parser.add_argument("--apply", action="store_true", help="delete; without it only report")
    args = parser.parse_args()
    try:
        if args.keep < 1 or args.min_age_days < 1:
            raise ValueError("--keep and --min-age-days must be at least 1")
        s3, bucket = release.client()
        result = plan(s3, bucket, args.keep, timedelta(days=args.min_age_days))
        if args.apply:
            delete(s3, bucket, [key for group in result.values() for key in group["keys"]])
        print(json.dumps({"applied": args.apply, "groups": {
            group: {**entry, "keys": len(entry["keys"])} for group, entry in result.items()}}))
    except Exception as error:
        parser.exit(1, f"Retention stopped: {error}\n")


if __name__ == "__main__":
    main()
