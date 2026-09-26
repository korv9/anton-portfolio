"""Catalogue every delivered data file so the site resolves URLs instead of hardcoding paths.

Writes two files:

  public/data/catalog.json   full catalogue, one entry per delivered file, following the
                             delivery contract: path, product, format, bytes, rows,
                             schema_version, partition, sha256, run_id. Read by the
                             validators and the upload step. The browser never fetches it.
  public/data/delivery.json  the base URL per format, a few hundred bytes. This is what the
                             site fetches at startup, so it stays inside the JSON budget.

`bases` maps a format to the base URL its files are served from. Moving shards to object
storage is a change to BASES here, not a change to any component.

run_id is derived from the catalogued content, never from the wall clock, so an unchanged
tree rebuilds to byte-identical output.
"""
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PUBLIC = ROOT / "frontend/public/data"
CATALOG = PUBLIC / "catalog.json"
DELIVERY = PUBLIC / "delivery.json"
SCHEMA_VERSION = 1

# Base URL per format. Point "shard" at the object-storage prefix once the bucket is live;
# the site reads these and needs no code change.
BASES = {
    "json": "data/",
    # Parquet is queried in the browser over range requests, so it lives beside the shards.
    "parquet": "https://pub-9867b18896ba49e4a0b4a3d2f39c0385.r2.dev/",
    # Cloudflare R2, public development URL. Cloudflare rate-limits r2.dev and advises against
    # relying on it in production; move this to a custom domain before the site is announced.
    "shard": "https://pub-9867b18896ba49e4a0b4a3d2f39c0385.r2.dev/",
}

# Directories whose files are addressed one at a time through an index, and are read as whole
# documents rather than queried. Their index.json stays a normal JSON contract.
SHARD_DIRECTORIES = (
    "politics/parliament/issues/",
    "politics/parliament/debates/",
    "politics/decisions/",
    "politics/laws/v1/",
    "politics/laws/v2/",
)

SESSION_PATTERN = re.compile(r"/(?:session=)?(\d{4}-\d{2,4})/")


def classify(relative: str) -> str:
    if relative.endswith(".parquet"):
        return "parquet"
    if relative.endswith("/index.json"):
        return "json"
    if any(relative.startswith(directory) for directory in SHARD_DIRECTORIES):
        return "shard"
    return "json"


def product_of(relative: str) -> str:
    top = relative.split("/", 1)[0]
    return {"gold": "gold", "politics": "politics", "discovery": "politics",
            "debates": "politics", "products": "products", "reports": "products",
            "jobs": "jobs"}.get(top, top)


def partition_of(relative: str) -> str | None:
    match = SESSION_PATTERN.search("/" + relative)
    if not match:
        return None
    raw = match.group(1)
    return f"session={raw[:4]}/{raw[5:]}" if len(raw) == 7 else f"session={raw[:4]}/{raw[4:]}"


def row_count(path: Path, fmt: str) -> int | None:
    """Row count for tabular JSON only. Shards are documents and are never counted."""
    if fmt != "json":
        return None
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError):
        return None
    if isinstance(payload, list):
        return len(payload)
    if isinstance(payload, dict) and isinstance(payload.get("data"), list):
        return len(payload["data"])
    return None


def carried_forward(seen):
    """Entries for files that are delivered from object storage and no longer local.

    Walking public/data alone would silently drop every moved file, leaving the catalogue
    claiming the delivery is smaller than it is and giving the uploader nothing to verify.
    A remote entry is kept until its format stops being remote or it is explicitly removed.
    """
    if not CATALOG.is_file():
        return []
    previous = json.loads(CATALOG.read_text(encoding="utf-8"))
    record = PUBLIC / "offloaded.json"
    offloaded = set(json.loads(record.read_text(encoding="utf-8"))) if record.is_file() else set()
    remote = {fmt for fmt, base in previous.get("bases", {}).items() if base.startswith("https://")}
    carried = []
    for entry in previous["files"]:
        if entry["path"] in seen or entry["format"] not in remote:
            continue
        path = PUBLIC / entry["path"]
        if path.is_file():
            continue
        # A missing file was either offloaded after a verified upload, in which case it
        # must stay catalogued, or is simply no longer produced by the build, in which case
        # it must not. The filesystem cannot tell them apart, so the offload step records
        # what it removed and that record decides.
        if entry["path"] not in offloaded:
            continue
        carried.append(entry)
    return carried


def build() -> dict:
    files = []
    for path in sorted(PUBLIC.rglob("*")):
        if not path.is_file() or path == CATALOG:
            continue
        if path in (DELIVERY, PUBLIC / "offloaded.json"):
            continue
        relative = path.relative_to(PUBLIC).as_posix()
        # CRLF is normalised for both size and hash, so a Windows and a Linux checkout of the
        # same tree produce the same catalogue.
        content = path.read_bytes().replace(b"\r\n", b"\n")
        fmt = classify(relative)
        entry = {
            "path": relative,
            "product": product_of(relative),
            "format": fmt,
            "bytes": len(content),
            "rows": row_count(path, fmt),
            "schema_version": SCHEMA_VERSION,
            "partition": partition_of(relative),
            "sha256": hashlib.sha256(content).hexdigest(),
        }
        files.append(entry)

    files.extend(carried_forward({entry["path"] for entry in files}))
    files.sort(key=lambda entry: entry["path"])

    fingerprint = hashlib.sha256(
        "".join(f"{entry['path']}:{entry['sha256']}" for entry in files).encode()
    ).hexdigest()[:16]
    for entry in files:
        entry["run_id"] = fingerprint

    return {"schema_version": SCHEMA_VERSION, "run_id": fingerprint, "bases": BASES, "files": files}


def main() -> None:
    catalog = build()
    CATALOG.write_text(json.dumps(catalog, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    # DuckDB cannot glob over HTTP, so the parts of each Parquet dataset are listed here for
    # the browser to pass to read_parquet as an explicit array.
    datasets: dict[str, list[str]] = {}
    for entry in catalog["files"]:
        if entry["format"] == "parquet":
            datasets.setdefault(entry["path"].split("/")[1], []).append(entry["path"])
    DELIVERY.write_text(
        json.dumps({"schema_version": SCHEMA_VERSION, "run_id": catalog["run_id"],
                    "bases": BASES, "shard_prefixes": list(SHARD_DIRECTORIES),
                    "parquet_datasets": {name: sorted(parts)
                                         for name, parts in sorted(datasets.items())}},
                   ensure_ascii=False, indent=1) + "\n",
        encoding="utf-8")
    totals = {}
    for entry in catalog["files"]:
        current = totals.setdefault(entry["format"], [0, 0])
        current[0] += 1
        current[1] += entry["bytes"]
    print(f"run_id {catalog['run_id']}, {len(catalog['files'])} files")
    for fmt in sorted(totals):
        count, size = totals[fmt]
        print(f"  {fmt:8} {count:>5} files  {size / 1048576:>8.1f} MB")


if __name__ == "__main__":
    main()
