"""Paths, JSON and hashing shared by the build and validation scripts.

These were duplicated across the scripts, and had drifted: six local definitions of `read`
used four different encodings, and hashing was reimplemented in five places with and without
newline normalisation. Line-ending normalisation in particular is not cosmetic, because
.gitattributes checks some of this data out with native endings on Windows.
"""
import hashlib
import json
import os
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PUBLIC = ROOT / "frontend/public/data"
GOLD = PUBLIC / "gold"
POLITICS = PUBLIC / "politics"


def read_json(path):
    """Parse JSON from a path. utf-8-sig tolerates a byte-order mark; plain utf-8 files
    decode identically, so this is safe for every source in the repository."""
    return json.loads(Path(path).read_text(encoding="utf-8-sig"))


def unwrap(payload):
    """Some upstream exports wrap their rows in a {'data': [...]} envelope. Return the rows."""
    return payload.get("data", payload) if isinstance(payload, dict) else payload


def write_json(path, data, indent=None):
    """Write JSON and return the path. Compact by default, which is what the site fetches."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    text = (json.dumps(data, ensure_ascii=False, indent=indent) + "\n" if indent
            else json.dumps(data, ensure_ascii=False, separators=(",", ":")))
    path.write_text(text, encoding="utf-8")
    return path


def write_bytes_retrying(path, payload: bytes, attempts: int = 5):
    """Write bytes, retrying briefly on transient Windows open failures.

    A build writes dozens of files in quick succession, and on Windows an indexer, virus
    scanner or editor file-watcher holding a freshly created file makes open() fail with
    EINVAL or EACCES. The failure moves between files from run to run, so it is contention
    rather than anything wrong with the path.
    """
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    for attempt in range(attempts):
        # Write beside the target and rename over it. Opening an existing file for
        # truncation is what fails here; creating a fresh one and replacing it atomically
        # also means a crashed build never leaves a half-written table behind.
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
    """SHA-256 over content with CRLF normalised to LF, so a hash is stable across platforms."""
    return hashlib.sha256(content.replace(b"\r\n", b"\n")).hexdigest()


def portable_sha(path) -> str:
    return sha_of(Path(path).read_bytes())


def load_env():
    """Read ROOT/.env into the environment without overriding what is already set.

    Tolerates spaces around '=', quoted values, comments and 'export ' prefixes, because a
    hand-written .env usually has at least one of them. Real environment variables win, so CI
    secrets are never shadowed by a stale local file.
    """
    path = ROOT / ".env"
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8-sig").splitlines():
        line = line.strip().removeprefix("export ").strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, _, value = line.partition("=")
        name, value = name.strip(), value.strip().strip("\"'")
        if name and value and name not in os.environ:
            os.environ[name] = value


def raw_sha(path) -> str:
    """SHA-256 of the exact bytes, without newline normalisation.

    The politics catalogue records these, so its entries must keep using this rather than
    portable_sha.
    """
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()
