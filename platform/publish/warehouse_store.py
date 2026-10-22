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
    cluster_lab/...       the Cluster Lab runs the site's demos depend on (CLUSTER_LAB_RUNS), not
                          the lab's caches or test runs

    python platform/publish/warehouse_store.py push            # warehouse and raw files
    python platform/publish/warehouse_store.py push --only db  # or --only raw, features, cluster_lab
    python platform/publish/warehouse_store.py pull            # fetch both back
    python platform/publish/warehouse_store.py status          # what the bucket holds
    python platform/publish/warehouse_store.py pull --only raw --path jobtech/stream
                                                               # one folder (daily refreshes)

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
CLUSTER_LAB = Path(os.environ.get("PORTFOLIO_CLUSTER_LAB", ROOT / "warehouse/cluster_lab"))
PREFIX = "warehouse/"
DB_KEY = PREFIX + "portfolio.duckdb.gz"
MANIFEST_KEY = PREFIX + "manifest.json"
RAW_PREFIX = PREFIX + "raw/"
FEATURES_PREFIX = PREFIX + "features/"
CLUSTER_LAB_PREFIX = PREFIX + "cluster_lab/"
TREES = ("raw", "features", "cluster_lab")
# A prune deletes stored files that are absent locally; more than this share of a folder's stored
# files is taken as an incomplete local tree, not a cleanup. Raise it (--max-delete-pct or
# PRUNE_MAX_DELETE_PCT) only for an intentional cleanup.
MAX_DELETE_PCT = float(os.environ.get("PRUNE_MAX_DELETE_PCT") or 5)
# The debate map (SBERT pick, its layout and passages) and the bge-m3 run behind the Workers AI demo.
CLUSTER_LAB_RUNS = (
    "public-topics-2026-10-12/datasets/debate",
    "public-consensus-2026-10-13/pick-debate.json",
    "public-consensus-2026-10-13/layout-debate.json",
    "public-consensus-2026-10-13/layout-debate.parquet",
    "public-consensus-2026-10-13/debate-sbert",
    "public-consensus-2026-10-13/debate-bge-m3",
    "public-consensus-2026-10-13/pick-debate-bge-m3.json",
    "workers-ai-debate-bge-m3",
    "workers_ai_ledger.jsonl",
)


def tree(name: str) -> tuple[Path, str]:
    """A file tree stored next to the warehouse: (local directory, key prefix)."""
    return {"raw": (RAW, RAW_PREFIX), "features": (FEATURES, FEATURES_PREFIX),
            "cluster_lab": (CLUSTER_LAB, CLUSTER_LAB_PREFIX)}[name]


def folders(name: str, subs: list[str]) -> list[str]:
    """The folders to push: the given ones, or for cluster_lab only the listed runs, never the caches."""
    return list(CLUSTER_LAB_RUNS) if name == "cluster_lab" and subs == [""] else subs
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
    if root.is_file():
        return [] if root.name.endswith(".tmp") else [root]
    if not root.is_dir():
        return []
    return sorted(p for p in root.rglob("*") if p.is_file() and not p.name.endswith(".tmp"))


def prune_refusal(name: str, sub: str, local: int, stored: int, stale: int, max_pct: float) -> str | None:
    """Why deleting `stale` of a folder's `stored` files would be unsafe, or None."""
    if not stale:
        return None
    if not local:
        return "the local folder is empty"
    if name == "raw" and not (RAW / sub.strip("/").split("/")[0] / "_manifest.jsonl").is_file():
        return "its local fetch log (_manifest.jsonl) is missing, so the restore was incomplete"
    share = 100 * stale / stored
    if share > max_pct:
        return f"{stale} of {stored} stored files ({share:.1f} %) is more than {max_pct:g} %"
    return None


def push_tree(s3, bucket: str, name: str, sub: str = "", prune: bool = False,
              max_delete_pct: float = MAX_DELETE_PCT) -> tuple[int, int, int]:
    """Upload a tree's files whose SHA-256 differs from the stored copy. Returns (files, sent, bytes).

    `sub` limits it to one folder of the tree (jobtech/stream), for the daily refreshes.
    """
    root, prefix = tree(name)
    root = resolved_path(root)
    if not resolved_path(root / sub).is_relative_to(root):
        raise ValueError(f"Invalid path outside the {name} tree: {sub}")
    files = tree_files(root / sub)

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
    if prune:
        wanted = prefix + sub.strip("/")
        local = {prefix + p.relative_to(root).as_posix() for p in files}
        stored = [obj["Key"] for page in s3.get_paginator("list_objects_v2").paginate(Bucket=bucket, Prefix=wanted)
                  for obj in page.get("Contents", [])
                  if obj["Key"] == wanted or obj["Key"].startswith(wanted + "/")]
        stale = [key for key in stored if key not in local]
        refusal = prune_refusal(name, sub, len(files), len(stored), len(stale), max_delete_pct)
        if refusal:
            sys.exit(f"Refusing to prune {wanted}: {refusal}. Nothing was deleted; uploads are kept.")
        for key in stale:
            s3.delete_object(Bucket=bucket, Key=key)
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


def resolved_path(path: Path) -> Path:
    # Windows can return the extended-length prefix while a parent is being created.
    return Path(path.resolve().as_posix().replace("//?/UNC/", "//", 1).removeprefix("//?/"))


# Large folders that a whole-tree pull skips; fetch them by name with --path.
ON_DEMAND = ("jobtech/cluster-corpus",)


def pull_tree(s3, bucket: str, name: str, sub: str = "") -> int:
    root, prefix = tree(name)
    root.mkdir(parents=True, exist_ok=True)
    root = resolved_path(root)
    keys = []
    # A folder (jobtech/stream) or a single file (jobtech/_manifest.jsonl).
    wanted = prefix + sub.strip("/")
    for page in s3.get_paginator("list_objects_v2").paginate(Bucket=bucket, Prefix=wanted):
        keys += [(o["Key"], o["Size"]) for o in page.get("Contents", [])
                 if (sub and (o["Key"] == wanted or o["Key"].startswith(wanted + "/")))
                 or (not sub and not any(o["Key"].startswith(prefix + p + "/") for p in ON_DEMAND))]

    def one(item: tuple[str, int]) -> int:
        key, size = item
        target = root / key[len(prefix):]
        resolved = resolved_path(target)
        if not resolved.is_relative_to(root):
            raise ValueError(f"Invalid stored path: {key}")
        if target.name.endswith(".tmp"):
            return 0
        meta = remote_meta(s3, bucket, key)
        if target.is_file() and target.stat().st_size == size:
            if meta and meta["sha256"] == sha256(target):
                return 0
        target.parent.mkdir(parents=True, exist_ok=True)
        temporary = target.with_name(target.name + ".tmp")
        try:
            s3.download_file(bucket, key, str(temporary))
            if temporary.stat().st_size != size or (meta and meta["sha256"]
                                                    and sha256(temporary) != meta["sha256"]):
                raise ValueError(f"Stored {name} file failed integrity check: {key}")
            os.replace(temporary, target)
        finally:
            temporary.unlink(missing_ok=True)
        return 1

    with ThreadPoolExecutor(max_workers=8) as pool:
        fetched = sum(pool.map(one, keys))
    print(f"{name.capitalize()} files{' in ' + sub if sub else ''}: {len(keys)} stored, "
          f"{fetched} fetched to {root}")
    return fetched


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("action", choices=["push", "pull", "status"])
    parser.add_argument("--only", choices=["db", *TREES],
                        help="Only the warehouse, the raw files, the ML outputs or the Cluster Lab runs")
    parser.add_argument("--path", action="append", default=[],
                        help="With --only raw or features: only this folder or file of the tree "
                             "(repeatable), e.g. --path jobtech/stream")
    parser.add_argument("--prune", action="store_true",
                        help="Delete remote files absent locally in the fully restored --path folders")
    parser.add_argument("--max-delete-pct", type=float, default=MAX_DELETE_PCT,
                        help="With --prune: refuse when more than this share of a folder's stored "
                             "files would be deleted (default %(default)g, or PRUNE_MAX_DELETE_PCT)")
    args = parser.parse_args()
    if args.path and args.only not in TREES:
        parser.error("--path needs --only raw, features or cluster_lab")
    if args.prune and (args.action != "push" or args.only not in TREES or not args.path):
        parser.error("--prune needs push --only raw/features/cluster_lab with explicit --path folders")
    subs = args.path or [""]

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
                for sub in subs:
                    pull_tree(s3, bucket, name, sub)
        if args.only in (None, "db"):
            pull_db(s3, bucket)
        return 0
    counts: dict[str, int | None] = {}
    for name in TREES:
        if args.only in (None, name):
            for sub in folders(name, subs):
                counts[name], sent, sent_bytes = push_tree(s3, bucket, name, sub, args.prune,
                                                               args.max_delete_pct)
                print(f"{name.capitalize()} files{' in ' + sub if sub else ''}: {counts[name]} "
                      f"on disk, {sent} uploaded ({sent_bytes / 1e6:.0f} MB)")
    if args.only in (None, "db"):
        manifest = push_db(s3, bucket, counts)
        print(f"Warehouse stored: {manifest['bytes'] / 1e6:.0f} MB, "
              f"{manifest['gzip_bytes'] / 1e6:.0f} MB compressed, sha256 {manifest['sha256'][:12]}…")
    return 0


if __name__ == "__main__":
    sys.exit(main())
