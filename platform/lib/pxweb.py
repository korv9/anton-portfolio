"""Download whole PxWeb v1 tables (SCB, Folkhälsomyndigheten) into the bronze store.

A PxWeb v1 table eliminates any variable left out of the query, which silently returns
totals instead of the breakdown, so every variable is selected explicitly. Servers cap a
response at a number of cells (150,000 at SCB); a table larger than `max_cells` is split
along its time variable into parts, written as `<dataset>/part-NNN.json`, which bronze
reads as one glob.
"""
from __future__ import annotations

import math
from pathlib import Path

import requests

import rawstore
from rawstore import fetch


def metadata(http: requests.Session, url: str) -> dict:
    response = http.get(url, timeout=120)
    response.raise_for_status()
    return response.json()


def time_code(meta: dict) -> str:
    """The time variable is flagged `time: true`; tables without one split on the last."""
    for variable in meta["variables"]:
        if variable.get("time"):
            return variable["code"]
    return meta["variables"][-1]["code"]


def plan_queries(meta: dict, selections: dict[str, list[str]] | None = None,
                 max_cells: int = 100_000, eliminate: tuple[str, ...] = ()) -> list[list[dict]]:
    """Queries covering the table (or `selections` of it), each under `max_cells`.

    `eliminate` names variables to leave out on purpose, so the server returns their total;
    it is refused for a variable the table does not allow to be eliminated.
    """
    selections = selections or {}
    codes = {v["code"]: v for v in meta["variables"]}
    unknown = (set(selections) | set(eliminate)) - set(codes)
    if unknown:
        raise ValueError(f"Unknown PxWeb variables: {sorted(unknown)}")
    for code in eliminate:
        if not codes[code].get("elimination"):
            raise ValueError(f"PxWeb variable {code} cannot be eliminated")
    chosen = {v["code"]: selections.get(v["code"], v["values"]) for v in meta["variables"]
              if v["code"] not in eliminate}
    split = time_code(meta)
    per_slice = math.prod(len(values) for code, values in chosen.items() if code != split)
    step = max(1, max_cells // max(per_slice, 1))
    times = chosen[split]
    queries = []
    for start in range(0, len(times), step):
        query = []
        for code, values in chosen.items():
            part = times[start:start + step] if code == split else values
            query.append({"code": code, "selection": {"filter": "item", "values": part}})
        queries.append(query)
    return queries


def download_table(http: requests.Session, source: str, dataset: str, url: str,
                   selections: dict[str, list[str]] | None = None, max_cells: int = 100_000,
                   pause: float = 0.5, eliminate: tuple[str, ...] = ()) -> list[Path]:
    """Fetch a table as PxWeb JSON parts and its metadata, returning the part paths."""
    meta = metadata(http, url)
    fetch(http, source, f"{dataset}/metadata.json", url, pause=pause)
    paths = []
    for index, query in enumerate(plan_queries(meta, selections, max_cells, eliminate)):
        body = {"query": query, "response": {"format": "json"}}
        paths.append(fetch(http, source, f"{dataset}/part-{index:03d}.json", url,
                           method="POST", body=body, pause=pause))
    # A table that shrank to fewer parts must not leave old parts behind for the glob.
    for stale in set((rawstore.RAW / source / dataset).glob("part-*.json")) - set(paths):
        stale.unlink()
    return paths
