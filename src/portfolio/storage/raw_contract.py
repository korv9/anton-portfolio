"""Raw-file contracts: how bronze reads a raw file is how rawstore checks it before writing it.

The contract of a raw path is the bronze source table that reads it: its dbt-duckdb
`external_location` in platform/models/bronze/**/*.yml. rawstore.store runs that reader on the
payload before the file is replaced, so a payload bronze could not read never becomes the stored
copy. One definition serves both ends; nothing is inferred twice.

A reader is fixed when it does not guess a schema from the data: `read_json`/`read_csv` with
`columns =`, and the readers whose schema the format fixes (`read_json_objects`, `read_text`,
`read_blob`, `read_parquet`). A source table may keep its columns in `meta.columns` (a mapping of
column to DuckDB type) and write `columns = {columns}` in its location; dbt-duckdb formats the
location with the table's meta, and so does `contract()`. INFERRED lists the tables that still
guess; it may only shrink (platform/tests/python/test_raw_contract.py).
"""
from __future__ import annotations

import gzip
import re
import tempfile
from dataclasses import dataclass
from fnmatch import fnmatchcase
from functools import lru_cache
from pathlib import Path

from portfolio.core.config import ROOT

BRONZE = ROOT / "platform" / "models" / "bronze"
RAW_VAR = re.compile(r"\{\{\s*env_var\('PORTFOLIO_RAW',\s*'[^']*'\)\s*\}\}")
RAW_LITERAL = re.compile(r"'@RAW@/([^']+)'")
READER = re.compile(r"\s*(\w+)\s*\(")
FIXED_BY_FORMAT = frozenset({"read_json_objects", "read_text", "read_blob", "read_parquet"})

# ponytail: the tables whose reader still infers its schema from the data. The build's
# raw_schemas.py report gives each one's current columns; a table leaves this list when its
# location takes `columns = {columns}` from meta.columns.
INFERRED = frozenset({
    "catalogue.kolada_kpis", "catalogue.scb_tables", "ess.respondents", "eu_ai_act.fetches",
    "eu_ai_act.guidance_sources", "eu_ai_act.text_attempts", "fk.ongoing_by_age",
    "fk.sick_pay_rate", "fk.started_by_diagnosis", "fk.started_by_diagnosis_meta",
    "fk.started_stress", "fohm.hlv1allmaald", "fohm.hlv1allmxreg", "fohm.hlv1psyaald",
    "fohm.hlv1psyxreg", "fohm.hlv1socaald", "fohm.hlv1socxreg", "fohm.metadata",
    "jobtech_governance.manifests", "jobtech_market.manifests", "kolada.kpi_values",
    "kolada.kpis", "kolada.municipalities", "news.fetches", "news.items", "news.people",
    "philosophy.corpus", "philosophy.fetches", "riksdagen_speeches.fetches",
    "rs_prognos.residents", "scb.aku_month", "scb.aku_region_metadata", "scb.aku_region_quarter",
    "scb.aku_region_year", "scb.population_region_metadata", "scb.population_year",
    "scb.population_year_current", "scb_deso.employed", "scb_deso.residents",
    "scb_elections.election_country", "scb_elections.election_municipality",
    "scb_elections.election_seats", "scb_elections.psu", "sfs.catalogue", "sfs.fetches",
    "sfs.selection", "skatteverket.municipal_rates", "sl_facts.parsed", "sl_gtfs.calendar",
    "sl_gtfs.calendar_dates", "sl_gtfs.feed_info", "sl_gtfs.routes", "sl_gtfs.stop_times",
    "sl_gtfs.stops", "sl_gtfs.trips", "symbolic.corpus", "symbolic.fetches",
    "val.riksdag_result",
})


@dataclass(frozen=True)
class Contract:
    table: str          # <source>.<table> as dbt names it
    reader: str         # read_json, read_csv, ...
    expression: str     # the location, raw paths written '@RAW@/<glob>'
    globs: tuple[str, ...]

    @property
    def fixed(self) -> bool:
        return self.reader in FIXED_BY_FORMAT or re.search(r"\bcolumns\s*=", self.expression) is not None

    def matches(self, path: str) -> bool:
        return any(fnmatchcase(path, glob) for glob in self.globs)

    def on(self, file: Path) -> str:
        """The reader with every raw path replaced by one file."""
        return RAW_LITERAL.sub(f"'{file.as_posix()}'", self.expression)


def _meta(*levels: dict) -> dict:
    merged: dict = {}
    for level in levels:
        merged |= level.get("meta") or {}
        merged |= level.get("config") or {}
    return merged


@lru_cache(maxsize=1)
def contracts(bronze: Path = BRONZE) -> tuple[Contract, ...]:
    """Every bronze source table that reads raw files, in file order."""
    import yaml

    found = []
    for file in sorted(bronze.rglob("*.yml")):
        for source in (yaml.safe_load(file.read_text(encoding="utf-8")) or {}).get("sources") or []:
            for table in source.get("tables") or []:
                meta = _meta(source, table)
                location = meta.get("external_location")
                if not location or not RAW_VAR.search(location):
                    continue
                values = {"name": table["name"], "identifier": table.get("identifier", table["name"]),
                          "schema": source["name"], **meta}
                expression = RAW_VAR.sub("@RAW@", location).format_map(values)
                reader = READER.match(expression)
                found.append(Contract(f"{source['name']}.{table['name']}",
                                      reader.group(1) if reader else "path", expression,
                                      tuple(RAW_LITERAL.findall(expression))))
    return tuple(found)


@lru_cache(maxsize=1)
def _connection():
    import duckdb

    return duckdb.connect()


def check(source: str, relative: str, payload: bytes) -> list[str]:
    """Read the payload with every bronze reader of raw/<source>/<relative>; return their tables.

    Raises ValueError when a reader rejects it: invalid JSON or CSV, or a value its declared
    columns cannot hold. An empty list means no bronze table reads the path.
    """
    path = f"{source}/{relative}"
    readers = [contract for contract in contracts() if contract.matches(path)]
    if not readers:
        return []
    with tempfile.TemporaryDirectory() as folder:
        file = Path(folder) / Path(relative).name
        file.write_bytes(gzip.compress(payload, mtime=0) if relative.endswith(".gz") else payload)
        for contract in readers:
            try:
                _connection().sql(f"select count(columns(*)) from {contract.on(file)}").fetchall()
            except Exception as error:  # duckdb raises its own error classes
                raise ValueError(f"{path} does not satisfy {contract.table}: "
                                 f"{str(error).splitlines()[0][:300]}") from error
    return [contract.table for contract in readers]


def report(raw: Path) -> dict:
    """What the stored raw files say: the columns each inferring reader finds now (the schema to
    fix in meta.columns), and the logged raw paths no bronze table reads."""
    import json

    found: dict = {"inferred": {}, "unread": []}
    for contract in contracts():
        if contract.fixed:
            continue
        expression = RAW_LITERAL.sub(lambda m: f"'{(raw / m.group(1)).as_posix()}'", contract.expression)
        try:
            rows = _connection().sql(f"describe select * from {expression}").fetchall()
            found["inferred"][contract.table] = {name: kind for name, kind, *_ in rows}
        except Exception as error:  # an absent or unreadable source is reported, not fatal
            found["inferred"][contract.table] = {"error": str(error).splitlines()[0][:300]}
    for log in sorted(raw.glob("*/_manifest.jsonl")):
        paths = set()
        for line in log.read_text(encoding="utf-8").splitlines():
            try:
                paths.add(json.loads(line)["path"])
            except (ValueError, KeyError, TypeError):
                continue
        source = log.parent.name
        found["unread"] += sorted(f"{source}/{p}" for p in paths
                                  if not any(c.matches(f"{source}/{p}") for c in contracts()))
    return found


if __name__ == "__main__":
    import json
    import os
    import sys

    from portfolio.core.config import WAREHOUSE

    print(json.dumps(report(Path(sys.argv[1] if len(sys.argv) > 1 else
                                 os.environ.get("PORTFOLIO_RAW", WAREHOUSE / "raw"))), indent=1))
