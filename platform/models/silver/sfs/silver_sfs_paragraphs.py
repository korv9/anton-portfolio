"""One row per paragraph (§) of the selected laws, or per stycke of a long one.

A dbt Python model, because the split is a line parser (platform/ingest/sfs/chunking.py, where
the rules are written down): chapters and paragraphs from the plain text, transitional
provisions and repealed paragraphs left out, the version in force on the fetch date kept, and the
amending act ("Lag (2019:937).") moved from the text to amended_by.
"""
import json
from pathlib import Path

import pandas as pd

RIKSDAGEN = "https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling"
COLUMNS = ["id", "sfs", "dok_id", "law_name", "law_title", "title", "avdelning", "chapter",
           "paragraph", "stycke", "text", "amended_by", "url", "fetched", "source_hash"]


def anchor(item: dict) -> str:
    """riksdagen.se's own anchors: K<chapter>P<paragraph>S<stycke>."""
    out = f"K{item['chapter'].replace(' ', '')}" if item["chapter"] else ""
    out += f"P{item['paragraph'].replace(' ', '')}"
    return out + (f"S{item['stycke']}" if item["stycke"] and item["stycke"] > 1 else "")


def model(dbt, session):
    dbt.config(materialized="table")
    import sys
    sys.path.insert(0, str(Path.cwd() / "ingest" / "sfs"))
    from chunking import paragraphs

    texts = dbt.ref("stg_sfs_texts").df().set_index("dok_id")
    selection = dbt.source("sfs", "selection").df()
    rows = []
    for law in selection.itertuples():
        text = texts.loc[law.dok_id]
        fetched = pd.Timestamp(text.fetched_at).date().isoformat()
        for item in paragraphs(text.text, sfs=law.sfs, name=law.name, fetched=fetched):
            rows.append({**item, "sfs": law.sfs, "dok_id": law.dok_id, "law_name": law.name,
                         "law_title": law.title, "fetched": fetched,
                         "url": f"{RIKSDAGEN}/_{law.dok_id}/#{anchor(item)}",
                         "source_hash": text.source_hash})
    frame = pd.DataFrame(rows).reindex(columns=COLUMNS)
    frame["stycke"] = frame["stycke"].astype("Int64")
    return frame
