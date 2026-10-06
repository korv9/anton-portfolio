"""Keep the DuckDB warehouse and its raw source files in R2, and fetch them back.

The warehouse (warehouse/portfolio.duckdb) and the raw files it is built from
(warehouse/raw/, each source's files with their URL, time and SHA-256) used to live only on
the machine that ran the pipeline. This stores both in the R2 bucket, so the warehouse survives
the machine and can be rebuilt exactly, even if an agency later changes or removes a file.

In the bucket, under warehouse/:

    portfolio.duckdb.gz   the warehouse, gzip-compressed
    manifest.json         when and from which commit it was built, its SHA-256 and size, the
                          row count per schema and how many raw files were stored with it
    raw/<source>/...      every raw file, as on disk; each carries its SHA-256 as metadata so a
                          rerun uploads only files that changed
    features/<stage>/...  the ML stages' outputs (embeddings, maps, clusters, concept alignment)
                          that dbt reads back as sources, stored the same way, so the gold marts
                          built on them can be rebuilt without rerunning the models

    python platform/publish/warehouse_store.py push            # warehouse and raw files
    python platform/publish/warehouse_store.py push --only db  # or --only raw, --only features
    python platform/publish/warehouse_store.py pull            # fetch both back
    python platform/publish/warehouse_store.py status          # what the bucket holds

The bucket is the site's public one, so everything stored here can be downloaded by anyone
from the r2.dev address. It holds only open data. Credentials as for upload.py: R2_ACCOUNT_ID,
R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, from the environment or a local .env.
"""
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))

from common import ROOT  # noqa: E402

DATABASE = Path(os.environ.get("PORTFOLIO_DB", ROOT / "warehouse/portfolio.duckdb"))
RAW = Path(os.environ.get("PORTFOLIO_RAW", ROOT / "warehouse/raw"))
FEATURES = Path(os.environ.get("PORTFOLIO_FEATURES", ROOT / "warehouse/features"))
PREFIX = "warehouse/"
DB_KEY = PREFIX + "portfolio.duckdb.gz"
MANIFEST_KEY = PREFIX + "manifest.json"
RAW_PREFIX = PREFIX + "raw/"
FEATURES_PREFIX = PREFIX + "features/"
TREES = ("raw", "features")


def tree(name: str) -> tuple[Path, str]:
    """A file tree stored next to the warehouse: (local directory, key prefix)."""
    return {"raw": (RAW, RAW_PREFIX), "features": (FEATURES, FEATURES_PREFIX)}[name]
CHUNK = 8 * 1024 * 1024


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(CHUNK), b""):
            digest.update(block)
    return digest.hexdigest()


def remote_meta(s3, bucket: str, key: str) -> dict | None:
    try:
        head = s3.head_object(Bucket=bucket, Key=key)
    except s3.exceptions.ClientError as error:
        if error.response.get("Error", {}).get("Code") in ("404", "NoSuchKey", "NotFound"):
            return None
        raise
    return {"size": head["ContentLength"], "sha256": head.get("Metadata", {}).get("sha256")}


def row_counts(path: Path) -> dict[str, int]:
    import duckdb

    con = duckdb.connect(str(path), read_only=True)
    try:
        tables = con.execute(
            "select table_schema, table_name from information_schema.tables "
            "where table_type = 'BASE TABLE'").fetchall()
        counts: dict[str, int] = {}
        for schema, name in tables:
            n = con.execute(f'select count(*) from "{schema}"."{name}"').fetchone()[0]
            counts[schema] = counts.get(schema, 0) + n
        return counts
    finally:
        con.close()


def git_commit() -> str | None:
    try:
        return subprocess.run(["git", "rev-parse", "HEAD"], cwd=ROOT, capture_output=True,
                              text=True, check=True).stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        return None


def tree_files(root: Path) -> list[Path]:
    if not root.is_dir():
        return []
    return sorted(p for p in root.rglob("*") if p.is_file())


def push_tree(s3, bucket: str, name: str) -> tuple[int, int, int]:
    """Upload a tree's files whose SHA-256 differs from the stored copy. Returns (files, sent, bytes)."""
    root, prefix = tree(name)
    files = tree_files(root)

    def one(path: Path) -> int:
        key = prefix + path.relative_to(root).as_posix()
        digest = sha256(path)
        meta = remote_meta(s3, bucket, key)
        if meta and meta["sha256"] == digest and meta["size"] == path.stat().st_size:
            return 0
        s3.upload_file(str(path), bucket, key, ExtraArgs={"Metadata": {"sha256": digest}})
        return path.stat().st_size

    with ThreadPoolExecutor(max_workers=8) as pool:
        sent = list(pool.map(one, files))
    return len(files), sum(1 for b in sent if b), sum(sent)


def push_db(s3, bucket: str, counts: dict[str, int | None]) -> dict:
    if not DATABASE.is_file():
        sys.exit(f"No warehouse at {DATABASE}")
    digest = sha256(DATABASE)
    with tempfile.TemporaryDirectory() as tmp:
        packed = Path(tmp) / "portfolio.duckdb.gz"
        with DATABASE.open("rb") as source, gzip.open(packed, "wb", compresslevel=6) as target:
            shutil.copyfileobj(source, target, CHUNK)
        s3.upload_file(str(packed), bucket, DB_KEY, ExtraArgs={
            "Metadata": {"sha256": digest}, "ContentType": "application/gzip"})
        packed_bytes = packed.stat().st_size
    manifest = {
        "built_at": datetime.fromtimestamp(DATABASE.stat().st_mtime, timezone.utc).isoformat(timespec="seconds"),
        "stored_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "git_commit": git_commit(),
        "github_run_id": os.environ.get("GITHUB_RUN_ID"),
        "key": DB_KEY,
        "sha256": digest,
        "bytes": DATABASE.stat().st_size,
        "gzip_bytes": packed_bytes,
        "rows_per_schema": row_counts(DATABASE),
        "raw_files": counts.get("raw"),
        "feature_files": counts.get("features"),
    }
    s3.put_object(Bucket=bucket, Key=MANIFEST_KEY, ContentType="application/json",
                  Body=json.dumps(manifest, indent=2).encode())
    return manifest


def pull_db(s3, bucket: str) -> bool:
    meta = remote_meta(s3, bucket, DB_KEY)
    if not meta:
        print("No stored warehouse yet; nothing to fetch.")
        return False
    DATABASE.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        packed = Path(tmp) / "portfolio.duckdb.gz"
        s3.download_file(bucket, DB_KEY, str(packed))
        unpacked = Path(tmp) / "portfolio.duckdb"
        with gzip.open(packed, "rb") as source, unpacked.open("wb") as target:
            shutil.copyfileobj(source, target, CHUNK)
        if meta["sha256"] and sha256(unpacked) != meta["sha256"]:
            sys.exit("The fetched warehouse does not match its stored SHA-256; keeping the local one.")
        shutil.move(str(unpacked), DATABASE)
    print(f"Fetched the warehouse to {DATABASE} ({DATABASE.stat().st_size / 1e6:.0f} MB)")
    return True


def pull_tree(s3, bucket: str, name: str) -> int:
    root, prefix = tree(name)
    keys = []
    for page in s3.get_paginator("list_objects_v2").paginate(Bucket=bucket, Prefix=prefix):
        keys += [(o["Key"], o["Size"]) for o in page.get("Contents", [])]

    def one(item: tuple[str, int]) -> int:
        key, size = item
        target = root / key[len(prefix):]
        if target.is_file() and target.stat().st_size == size:
            meta = remote_meta(s3, bucket, key)
            if meta and meta["sha256"] in (None, sha256(target)):
                return 0
        target.parent.mkdir(parents=True, exist_ok=True)
        s3.download_file(bucket, key, str(target))
        return 1

    with ThreadPoolExecutor(max_workers=8) as pool:
        fetched = sum(pool.map(one, keys))
    print(f"{name.capitalize()} files: {len(keys)} stored, {fetched} fetched to {root}")
    return fetched


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("action", choices=["push", "pull", "status"])
    parser.add_argument("--only", choices=["db", "raw", "features"],
                        help="Only the warehouse, only the raw files or only the ML outputs")
    args = parser.parse_args()

    from upload import client

    s3, bucket = client()
    if args.action == "status":
        try:
            body = s3.get_object(Bucket=bucket, Key=MANIFEST_KEY)["Body"].read()
            print(body.decode())
        except s3.exceptions.ClientError:
            print("No stored warehouse yet.")
        return 0
    if args.action == "pull":
        for name in TREES:
            if args.only in (None, name):
                pull_tree(s3, bucket, name)
        if args.only in (None, "db"):
            pull_db(s3, bucket)
        return 0
    counts: dict[str, int | None] = {}
    for name in TREES:
        if args.only in (None, name):
            counts[name], sent, sent_bytes = push_tree(s3, bucket, name)
            print(f"{name.capitalize()} files: {counts[name]} on disk, {sent} uploaded ({sent_bytes / 1e6:.0f} MB)")
    if args.only in (None, "db"):
        manifest = push_db(s3, bucket, counts)
        print(f"Warehouse stored: {manifest['bytes'] / 1e6:.0f} MB, "
              f"{manifest['gzip_bytes'] / 1e6:.0f} MB compressed, sha256 {manifest['sha256'][:12]}…")
    return 0


if __name__ == "__main__":
    sys.exit(main())
