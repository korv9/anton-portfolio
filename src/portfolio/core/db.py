"""The warehouse connection, opened one way (70 scripts called duckdb.connect themselves)."""
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path
from typing import TYPE_CHECKING

from portfolio.core import config

if TYPE_CHECKING:
    import duckdb


@contextmanager
def connect(path: Path | None = None, *, read_only: bool = True) -> Iterator["duckdb.DuckDBPyConnection"]:
    """Open the DuckDB warehouse, read-only unless asked, and close it on exit.

    Read-only is the default because exports and checks only read, and DuckDB allows any
    number of read-only connections beside a build but a single writer.
    """
    import duckdb  # deferred: importing portfolio.core must not need the warehouse driver

    connection = duckdb.connect(str(path or config.DATABASE), read_only=read_only)
    try:
        yield connection
    finally:
        connection.close()
