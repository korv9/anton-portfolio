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
from datetime import datetime, timezone
from pathlib import Path

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


def store(source: str, relative: str, payload: bytes, *, url: str, method: str = "GET",
          body: object | None = None) -> Path:
    """Write a payload under raw/<source>/<relative> and append its provenance line.

    The file is replaced only when its content changed. The manifest line is appended on
    every fetch, so the manifest is also the fetch log.
    """
    path = RAW / source / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    digest = sha256(payload)
    changed = stored_sha(path) != digest
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
    with (RAW / source / "_manifest.jsonl").open("a", encoding="utf-8") as manifest:
        manifest.write(json.dumps(record, ensure_ascii=False) + "\n")
    return path


def fetch(http: requests.Session, source: str, relative: str, url: str, *, method: str = "GET",
          body: object | None = None, pause: float = 0.0, timeout: int = 300) -> Path:
    """Fetch a URL and store it. `pause` spaces requests out for rate-limited APIs."""
    if method == "POST":
        response = http.post(url, json=body, timeout=timeout)
    else:
        response = http.get(url, timeout=timeout)
    response.raise_for_status()
    if pause:
        time.sleep(pause)
    return store(source, relative, response.content, url=url, method=method, body=body)
