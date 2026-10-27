"""The warehouse connection, opened one way (70 scripts called duckdb.connect themselves)."""
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path
from typing import TYPE_CHECKING

from portfolio.core import config

if TYPE_CHECKING:
    import duckdb


def warehouse(path: Path | None = None, *, read_only: bool = True) -> "duckdb.DuckDBPyConnection":
    """Open the DuckDB warehouse, read-only unless asked. For a script that holds it to the end.

    Read-only is the default because exports and checks only read, and DuckDB allows any
    number of read-only connections beside a build but a single writer.
    """
    import duckdb  # deferred: importing portfolio.core must not need the warehouse driver

    return duckdb.connect(str(path or config.DATABASE), read_only=read_only)


@contextmanager
def connect(path: Path | None = None, *, read_only: bool = True) -> Iterator["duckdb.DuckDBPyConnection"]:
    """As warehouse(), closed on exit."""
    connection = warehouse(path, read_only=read_only)
    try:
        yield connection
    finally:
        connection.close()
