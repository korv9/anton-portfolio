"""Opt-in Phase 0 contracts; no persistent database, fetching or publishing."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Protocol

import duckdb

from lib.rawstore import sha256


@dataclass(frozen=True)
class RetrievedDocument:
    """An adapter returns original bytes; storage and review are separate steps."""

    source_id: str
    source_url: str
    publisher: str
    fetched_at: datetime
    content_type: str
    content: bytes
    publication_date: date | None = None

    @property
    def document_hash(self) -> str:
        return sha256(self.content)


class DocumentReader(Protocol):
    """Future authority adapters must preserve original document bytes."""

    def read_document(self, source_url: str) -> RetrievedDocument: ...


def open_contract_database() -> duckdb.DuckDBPyConnection:
    """Create empty contracts in memory, isolated from the public warehouse."""
    connection = duckdb.connect(":memory:")
    try:
        connection.execute(Path(__file__).with_name("schema.sql").read_text(encoding="utf-8"))
    except Exception:
        connection.close()
        raise
    return connection
