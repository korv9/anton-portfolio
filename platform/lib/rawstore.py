"""Fetch source files into the bronze store and record where every byte came from.

Bronze is `warehouse/raw/<source>/`, exactly as fetched. Each source directory carries a
`_manifest.jsonl` with one line per fetch: URL, method, request body, fetch time, SHA-256
and size of the payload as received. Nothing in `models/` may read a file that has no line
here, and a refetch that returns identical bytes does not rewrite the file.

Large payloads are stored gzip-compressed (`.gz` suffix); the recorded hash is always of the
uncompressed bytes the server sent, so it can be checked against a fresh download.
"""
from __future__ import annotations

import gzip
import hashlib
import json
import os
import time
from functools import lru_cache
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

ROOT = Path(__file__).resolve().parents[2]
RAW = Path(os.environ.get("PORTFOLIO_RAW", ROOT / "warehouse" / "raw"))
USER_AGENT = "anton-portfolio-ingest/1.0 (+https://github.com/korv9/anton-portfolio)"


def session() -> requests.Session:
    """A session that retries throttling and transient server errors with backoff."""
    http = requests.Session()
    retry = Retry(total=5, backoff_factor=2, status_forcelist=[429, 500, 502, 503, 504],
                  allowed_methods=["GET", "POST"])
    http.mount("https://", HTTPAdapter(max_retries=retry))
    http.headers["User-Agent"] = USER_AGENT
    return http


def sha256(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def stored_sha(path: Path) -> str | None:
    """Hash of the uncompressed bytes currently on disk, or None if absent."""
    if not path.exists():
        return None
    data = path.read_bytes()
    return sha256(gzip.decompress(data) if path.suffix == ".gz" else data)


def full_refresh() -> bool:
    return os.environ.get("PORTFOLIO_FULL_REFRESH", "").lower() in {"1", "true", "yes"}


@lru_cache(maxsize=32)
def _records(path: Path, size: int, modified: int) -> dict:
    records = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        try:
            record = json.loads(line)
            records[record["path"]] = record
        except (ValueError, KeyError, TypeError):
            continue  # An interrupted final manifest line is not provenance.
    return records


def verified_record(source: str, relative: str) -> dict | None:
    """Require provenance and the actual payload hash, including after an R2 restore."""
    manifest = RAW / source / "_manifest.jsonl"
    if not manifest.is_file():
        return None
    stat = manifest.stat()
    record = _records(manifest, stat.st_size, stat.st_mtime_ns).get(relative)
    try:
        if record and stored_sha(RAW / source / relative) == record["sha256"]:
            return record
    except (OSError, EOFError, ValueError, KeyError):
        pass
    return None


def fresh(record: dict, max_age_days: float) -> bool:
    if full_refresh() or max_age_days <= 0:
        return False
    try:
        age = datetime.now(timezone.utc) - datetime.fromisoformat(record["fetched_at"])
        return 0 <= age.total_seconds() < max_age_days * 86400
    except (KeyError, ValueError, TypeError):
        return False


def reusable(source: str, relative: str, url: str, *, method: str = "GET",
             body: object | None = None, headers: dict | None = None,
             max_age_days: float = 90) -> bool:
    if full_refresh() or max_age_days <= 0:
        return False
    record = verified_record(source, relative)
    return bool(record and fresh(record, max_age_days) and record.get("url") == url
                and record.get("method") == method and record.get("body") == body
                and record.get("headers") == headers)


def complete(source: str, group: str, paths: list[Path], request: object) -> None:
    """Seal a paginated collection only after its terminal page was validated."""
    files = {}
    for path in paths:
        relative = path.relative_to(RAW / source).as_posix()
        record = verified_record(source, relative)
        if not record:
            raise ValueError(f"Unverified collection: {source}/{group}")
        files[relative] = record["sha256"]
    payload = json.dumps({"version": 1, "request": request, "files": files}).encode()
    store(source, f"_checkpoints/{group}.json", payload, url="checkpoint:" + group)


def invalidate(source: str, group: str) -> None:
    """A refresh in progress must not retain a previous completion seal."""
    (RAW / source / f"_checkpoints/{group}.json").unlink(missing_ok=True)


def completed_paths(source: str, group: str, request: object,
                    max_age_days: float | None = 90) -> list[Path] | None:
    relative = f"_checkpoints/{group}.json"
    record = verified_record(source, relative)
    if not record or (max_age_days is not None and not fresh(record, max_age_days)):
        return None
    try:
        checkpoint = json.loads((RAW / source / relative).read_text(encoding="utf-8"))
        if checkpoint["version"] != 1 or checkpoint["request"] != request:
            return None
        paths = []
        for relative, digest in checkpoint["files"].items():
            record = verified_record(source, relative)
            if not record or record["sha256"] != digest:
                return None
            paths.append(RAW / source / relative)
        return paths
    except (OSError, ValueError, KeyError, TypeError):
        return None


def store(source: str, relative: str, payload: bytes, *, url: str, method: str = "GET",
          body: object | None = None, headers: dict | None = None,
          logical_path: str | None = None) -> Path:
    """Write a payload under raw/<source>/<relative> and append its provenance line.

    The file is replaced only when its content changed. The manifest line is appended on
    every fetch, so the manifest is also the fetch log.
    """
    path = RAW / source / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    digest = sha256(payload)
    try:
        changed = stored_sha(path) != digest
    except (OSError, EOFError, ValueError):
        changed = True
    if changed:
        temporary = path.with_name(path.name + ".tmp")
        temporary.write_bytes(gzip.compress(payload, mtime=0) if path.suffix == ".gz" else payload)
        os.replace(temporary, path)
    record = {
        "path": relative,
        "url": url,
        "method": method,
        "body": body,
        "fetched_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "sha256": digest,
        "bytes": len(payload),
        "changed": changed,
    }
    if headers:
        record["headers"] = headers
    if logical_path:
        record["logical_path"] = logical_path
    manifest_path = RAW / source / "_manifest.jsonl"
    # A killed append may leave a fragment; discard it before writing the next record.
    if manifest_path.exists():
        with manifest_path.open("rb+") as handle:
            handle.seek(0, 2)
            size = handle.tell()
            if size:
                handle.seek(-1, 2)
                if handle.read(1) != b"\n":
                    handle.seek(0)
                    tail = handle.read().rfind(b"\n")
                    handle.truncate(tail + 1)
    with manifest_path.open("a", encoding="utf-8") as manifest:
        manifest.write(json.dumps(record, ensure_ascii=False) + "\n")
    return path


def fetch(http: requests.Session, source: str, relative: str, url: str, *, method: str = "GET",
          body: object | None = None, pause: float = 0.0, timeout: int = 300,
          headers: dict | None = None, versioned: bool = False,
          max_age_days: float = 0, validate: Callable[[bytes], None] | None = None) -> Path:
    """Fetch a URL and store it. `pause` spaces requests out for rate-limited APIs.

    `headers` are sent and recorded (content negotiation: format, language). With `versioned`
    every distinct payload is kept (see store_version) instead of replacing the file.
    """
    if not versioned and reusable(source, relative, url, method=method, body=body,
                                 headers=headers, max_age_days=max_age_days):
        path = RAW / source / relative
        try:
            if validate:
                payload = path.read_bytes()
                validate(gzip.decompress(payload) if path.suffix == ".gz" else payload)
        except (ValueError, KeyError, TypeError):
            pass
        else:
            print(f"Reuse {source}/{relative}", flush=True)
            return path
    if method == "POST":
        response = http.post(url, json=body, timeout=timeout, headers=headers)
    else:
        response = http.get(url, timeout=timeout, headers=headers)
    response.raise_for_status()
    if pause:
        time.sleep(pause)
    if validate:
        validate(response.content)
    save = store_version if versioned else store
    return save(source, relative, response.content, url=url, method=method, body=body,
                headers=headers)


def fetch_summary(source: str, since: str | None = None) -> dict:
    """What the fetch log of raw/<source> says: the latest fetch, when content last changed,
    files and bytes as last fetched, and with `since` (an ISO time) how many fetches, changes
    and failed requests came after it. Reads lines keyed by `path` (store) or `source` (feeds)."""
    manifest = RAW / source / "_manifest.jsonl"
    lines = []
    if manifest.is_file():
        for line in manifest.read_text(encoding="utf-8").splitlines():
            try:
                record = json.loads(line)
                key = record.get("path") or record["source"]
                if not key.startswith("_checkpoints/") and record["fetched_at"]:
                    lines.append((key, record))
            except (ValueError, KeyError, TypeError, AttributeError):
                continue  # An interrupted final line is not a fetch.
    if not lines:
        return {"source_key": source, "fetched_at": None}
    latest = dict(lines)
    changed = [r["fetched_at"] for _, r in lines if r.get("changed")]
    summary = {
        "source_key": source,
        "fetched_at": max(r["fetched_at"] for r in latest.values()),
        "content_changed_at": max(changed) if changed else None,
        "files": len(latest),
        "bytes": sum(r.get("bytes") or 0 for r in latest.values()),
    }
    if since:
        recent = [r for _, r in lines if r["fetched_at"] >= since]
        summary |= {"fetched": len(recent),
                    "changed": sum(1 for r in recent if r.get("changed")),
                    "errors": sum(1 for r in recent if r.get("error"))}
    return summary


def version_path(relative: str, digest: str) -> str:
    """`guidance/page.html` and a hash -> `guidance/page@<first 12 hex>.html`."""
    path = Path(relative)
    return str(path.with_name(f"{path.stem}@{digest[:12]}{path.suffix}")).replace("\\", "/")


def store_version(source: str, relative: str, payload: bytes, *, url: str, method: str = "GET",
                  body: object | None = None, headers: dict | None = None) -> Path:
    """Keep every distinct version of a payload: stored as `<stem>@<sha12><suffix>`.

    For sources that change in place (web pages, query answers), where the history is the
    point: a refetch with the same bytes writes nothing new, a change adds a file and never
    replaces an older one. The manifest line names the versioned path and the logical one.
    """
    digest = sha256(payload)
    relative_version = version_path(relative, digest)
    return store(source, relative_version, payload, url=url, method=method, body=body,
                 headers=headers, logical_path=relative)
