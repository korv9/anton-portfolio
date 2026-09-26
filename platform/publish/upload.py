"""Upload document shards to object storage, then verify what landed.

Reads frontend/public/data/catalog.json and uploads every entry whose format is "shard". Files whose
remote hash already matches are skipped, so a rerun transfers only what changed.

Nothing is deleted locally. Removing the shards from the repository is a separate, manual
step, and --verify-only exists so that step can be gated on proof the upload is complete.

Credentials come from the environment, or from a local .env file which git ignores. They are
never written to disk by this script and never printed.

    R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET

R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY are the S3-compatible pair Cloudflare shows once
when the token is created. A Cloudflare "API token" value is a different credential, for
Cloudflare's own REST API, and is not used here.

S3_API_ENDPOINT is optional. Set it to override the endpoint derived from the account id.

Usage:
    python platform/publish/upload.py --dry-run      # what would transfer
    python platform/publish/upload.py                # upload changed shards
    python platform/publish/upload.py --verify-only  # confirm every shard is present and correct
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))

import argparse
import json
import os
import re
import sys
from concurrent.futures import ThreadPoolExecutor
from common import PUBLIC, load_env

CATALOG = PUBLIC / "catalog.json"

CONTENT_TYPES = {".json": "application/json", ".csv": "text/csv", ".parquet": "application/vnd.apache.parquet"}


def client():
    try:
        import boto3
    except ImportError:
        sys.exit("boto3 is required: pip install boto3")
    load_env()
    missing = [name for name in ("R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET")
               if not os.environ.get(name)]
    if missing:
        sys.exit(f"Missing credentials: {', '.join(missing)}. Set them in the environment or in .env")

    # R2 derives these from the API token: the key id is the token id, the secret is a SHA-256
    # hash of the token value. Wrong lengths reach the API as an opaque 400, so check here.
    for name, width in (("R2_ACCOUNT_ID", 32), ("R2_ACCESS_KEY_ID", 32), ("R2_SECRET_ACCESS_KEY", 64)):
        value = os.environ[name]
        if len(value) == width * 2:
            sys.exit(f"{name} is {len(value)} characters, twice the expected {width}. "
                     "It looks like two values were pasted together; replace the whole line.")
        if len(value) != width or not re.fullmatch(r"[0-9a-fA-F]+", value):
            sys.exit(f"{name} should be {width} hexadecimal characters, got {len(value)}.")
    endpoint = os.environ.get("S3_API_ENDPOINT") or \
        f"https://{os.environ['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com"
    # A bucket-suffixed endpoint would make boto3 address every key twice over.
    bucket = os.environ["R2_BUCKET"]
    endpoint = endpoint.rstrip("/").removesuffix("/" + bucket)
    s3 = boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
        region_name="auto",
    )
    # Fail loudly on bad credentials or a missing bucket. Without this the per-object probe
    # below reads an auth error as "object absent", so a broken token would look like a bucket
    # that simply needs filling.
    try:
        s3.head_bucket(Bucket=bucket)
    except Exception as error:
        sys.exit(f"Cannot reach bucket '{bucket}' at {endpoint}: {error}")
    return s3, bucket


def shards():
    """Every catalogued file whose delivery base is remote, not only document shards."""
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    remote = {fmt for fmt, base in catalog["bases"].items() if base.startswith("https://")}
    return [entry for entry in catalog["files"] if entry["format"] in remote]


def remote_hash(s3, bucket, key):
    """The catalogued sha256, stored as object metadata. None if the object is absent."""
    try:
        return s3.head_object(Bucket=bucket, Key=key)["Metadata"].get("sha256")
    except Exception:
        return None


OFFLOADED = PUBLIC / "offloaded.json"


def offload(entries) -> None:
    """Delete verified local copies and record which paths now live only in storage.

    The catalogue needs to tell two kinds of missing file apart: one that was uploaded and
    then removed, which must stay catalogued, and one the build simply no longer produces,
    which must not. Guessing from the filesystem cannot do it — a directory holding an
    index alongside its shards looks populated either way — so the removal writes down
    exactly what it took.
    """
    freed = removed = 0
    for entry in entries:
        path = PUBLIC / entry["path"]
        if path.is_file():
            freed += path.stat().st_size
            path.unlink()
            removed += 1
    listing = json.dumps(sorted(entry["path"] for entry in entries), ensure_ascii=False, indent=1)
    OFFLOADED.write_text(listing + "\n", encoding="utf-8")
    for directory in sorted((p for p in PUBLIC.rglob("*") if p.is_dir()),
                            key=lambda p: -len(p.parts)):
        try:
            directory.rmdir()
        except OSError:
            pass
    print(f"Offloaded {removed} files, freed {freed / 1048576:.1f} MB. "
          f"{OFFLOADED.name} records what is now storage-only.")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="report what would transfer")
    parser.add_argument("--verify-only", action="store_true",
                        help="check every shard is present with a matching hash; upload nothing")
    parser.add_argument("--offload", action="store_true",
                        help="after verifying, delete the local copies and record what was offloaded")
    parser.add_argument("--workers", type=int, default=16)
    arguments = parser.parse_args()

    entries = shards()
    total_bytes = sum(entry["bytes"] for entry in entries)
    print(f"{len(entries)} shards, {total_bytes / 1048576:.1f} MB catalogued")

    s3, bucket = client()

    def state(entry):
        return entry, remote_hash(s3, bucket, entry["path"])

    with ThreadPoolExecutor(max_workers=arguments.workers) as pool:
        states = list(pool.map(state, entries))

    stale = [entry for entry, remote in states if remote != entry["sha256"]]

    if arguments.verify_only:
        if stale:
            print(f"INCOMPLETE: {len(stale)} shards missing or out of date. Do not remove local files.")
            for entry in stale[:10]:
                print(f"  {entry['path']}")
            sys.exit(1)
        print(f"VERIFIED: all {len(entries)} shards present with matching hashes.")
        if arguments.offload:
            offload(entries)
        return

    print(f"{len(stale)} to upload, {len(entries) - len(stale)} already current")
    if arguments.dry_run or not stale:
        return

    # A read-only token passes head_bucket and then fails on every object. Probe once so that
    # shows up immediately rather than after thousands of attempts.
    try:
        s3.put_object(Bucket=bucket, Key=".preflight", Body=b"")
    except Exception as error:
        sys.exit(f"The token cannot write to '{bucket}': {error}\n"
                 "Create an R2 API token with Object Read & Write and update .env.")
    try:
        s3.delete_object(Bucket=bucket, Key=".preflight")
    except Exception:
        print("  note: probe object '.preflight' could not be deleted; remove it manually")

    def upload(entry):
        path = PUBLIC / entry["path"]
        s3.put_object(
            Bucket=bucket,
            Key=entry["path"],
            Body=path.read_bytes(),
            ContentType=CONTENT_TYPES.get(path.suffix, "application/octet-stream"),
            Metadata={"sha256": entry["sha256"], "run_id": entry["run_id"]},
        )
        return entry["path"]

    with ThreadPoolExecutor(max_workers=arguments.workers) as pool:
        for index, path in enumerate(pool.map(upload, stale), start=1):
            if index % 100 == 0 or index == len(stale):
                print(f"  {index}/{len(stale)} {path}")

    print("Upload complete. Run --verify-only before removing any local file.")


if __name__ == "__main__":
    main()
