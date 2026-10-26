"""Reading, writing and hashing files the way every export and validator expects.

The site's JSON is compact and, for the exports, ends in a newline; platform/lib/common.py
wrote it without one. Both forms stay available so moving a script here changes no bytes.
"""
import hashlib
import json
import os
import time
from pathlib import Path
from typing import Any


def read_json(path) -> Any:
    """Parse JSON from a path. utf-8-sig tolerates a byte-order mark; plain utf-8 decodes the same."""
    return json.loads(Path(path).read_text(encoding="utf-8-sig"))


def unwrap(payload):
    """Some upstream exports wrap their rows in a {'data': [...]} envelope. Return the rows."""
    return payload.get("data", payload) if isinstance(payload, dict) else payload


def dumps(payload, *, indent: int | None = None, newline: bool = True, ensure_ascii: bool = False,
          allow_nan: bool = True) -> str:
    """The site's JSON text: compact unless indented, non-ASCII kept as is unless asked to escape.

    allow_nan=False raises on NaN or infinity instead of writing tokens browsers cannot parse.
    """
    options = {"ensure_ascii": ensure_ascii, "allow_nan": allow_nan}
    text = (json.dumps(payload, indent=indent, **options) if indent
            else json.dumps(payload, separators=(",", ":"), **options))
    return text + "\n" if newline else text


def write_json(path, payload, *, indent: int | None = None, newline: bool = True,
               ensure_ascii: bool = False, allow_nan: bool = True) -> Path:
    """Write JSON, creating the folder, and return the path.

    Always LF: text mode on Windows would write CRLF, so a local run differed from CI's bytes
    (some exporters passed newline="\\n" for this, most did not). On Linux nothing changes.
    """
    return write_text(path, dumps(payload, indent=indent, newline=newline, ensure_ascii=ensure_ascii,
                                  allow_nan=allow_nan))


def write_text(path, text: str) -> Path:
    """Write UTF-8 text with LF line endings, creating the folder, and return the path."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8", newline="\n")
    return path


def write_bytes_retrying(path, payload: bytes, attempts: int = 5) -> Path:
    """Write bytes atomically, retrying briefly on transient Windows open failures.

    An indexer, virus scanner or file watcher holding a fresh file makes open() fail with
    EINVAL or EACCES on Windows; writing beside the target and renaming over it avoids
    truncating an open file and never leaves a half-written table behind.
    """
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    for attempt in range(attempts):
        temporary = path.with_name(f"{path.name}.{os.getpid()}.tmp")
        try:
            temporary.write_bytes(payload)
            os.replace(temporary, path)
            return path
        except OSError:
            temporary.unlink(missing_ok=True)
            if attempt == attempts - 1:
                raise
            time.sleep(0.2 * (attempt + 1))
    return path


def sha_of(content: bytes) -> str:
    """SHA-256 with CRLF normalised to LF, so a hash is stable across platforms."""
    return hashlib.sha256(content.replace(b"\r\n", b"\n")).hexdigest()


def portable_sha(path) -> str:
    return sha_of(Path(path).read_bytes())


def raw_sha(path) -> str:
    """SHA-256 of the exact bytes; the politics catalogue records these."""
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()
