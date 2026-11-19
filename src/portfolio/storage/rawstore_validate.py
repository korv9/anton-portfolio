"""Checks a fetched answer must pass before rawstore stores it (src/portfolio/storage/rawstore.py).

A rejected answer raises ValueError, and the stored copy is kept. The default check depends on
the file's suffix. Every non-HTML file is also checked for an HTML error page served with
status 200. A caller can pass its own `validate`, which replaces the suffix check.
"""
from __future__ import annotations

import io
import json
import zipfile
from typing import Callable

HTML_SUFFIXES = (".html", ".htm", ".xml", ".html.gz", ".xml.gz")
# A stored file at least this large whose new answer is under SHRINK of it is taken as a truncated
# or empty answer, not a change.
# ponytail: one threshold for every source; give a source its own if it can legitimately shrink.
SHRINK, SHRINK_FLOOR = 0.10, 10_000


def json_document(payload: bytes) -> None:
    """Exactly one JSON value: an HTML error page or two concatenated answers raise ValueError."""
    json.loads(payload)


def json_lines(payload: bytes) -> None:
    for number, line in enumerate(payload.decode("utf-8").splitlines(), 1):
        if line.strip():
            try:
                json.loads(line)
            except ValueError as error:
                raise ValueError(f"line {number} is not JSON: {error}") from error


def csv_table(payload: bytes) -> None:
    if not payload.decode("utf-8-sig").strip().splitlines():
        raise ValueError("CSV answer has no header")


def zip_archive(payload: bytes) -> None:
    try:
        with zipfile.ZipFile(io.BytesIO(payload)) as archive:
            if bad := archive.testzip():
                raise ValueError(f"corrupt member {bad}")
    except zipfile.BadZipFile as error:
        raise ValueError(f"not a zip archive: {error}") from error


SUFFIXES: dict[tuple[str, ...], Callable[[bytes], None]] = {
    (".json", ".json.gz"): json_document,
    (".jsonl", ".jsonl.gz"): json_lines,
    (".csv", ".csv.gz"): csv_table,
    (".zip",): zip_archive,
}


def not_an_error_page(relative: str, payload: bytes) -> None:
    if relative.endswith(HTML_SUFFIXES):
        return
    head = payload[:200].lstrip().lower()
    if head.startswith((b"<!doctype html", b"<html")):
        raise ValueError("an HTML page where a data file was expected")


def default(relative: str) -> Callable[[bytes], None] | None:
    return next((check for suffixes, check in SUFFIXES.items() if relative.endswith(suffixes)), None)


def not_truncated(payload: bytes, previous_bytes: int | None) -> None:
    if previous_bytes and previous_bytes >= SHRINK_FLOOR and len(payload) < previous_bytes * SHRINK:
        raise ValueError(f"{len(payload)} bytes where the stored copy has {previous_bytes}")
