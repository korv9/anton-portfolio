"""One row per paragraph (§) of every SFS document fetched, or per stycke of a long one.

The split of silver_sfs_paragraphs (platform/ingest/sfs/chunking.py) applied to the whole list in
raw/sfs/catalogue.json, repealed documents included. Ids start with the dok_id, which is unique
where the SFS number is not. A document the split gets nothing from, or raises on, is counted in
silver_sfs_documents.parse_status rather than dropped silently.
"""
from pathlib import Path

import pandas as pd

COLUMNS = ["id", "dok_id", "sfs", "title", "avdelning", "chapter", "paragraph", "stycke", "text",
           "amended_by", "fetched", "source_hash"]


def model(dbt, session):
    dbt.config(materialized="table")
    import sys
    sys.path.insert(0, str(Path.cwd() / "ingest" / "sfs"))
    from chunking import paragraphs

    texts = dbt.ref("stg_sfs_texts").df()
    catalogue = dbt.source("sfs", "catalogue").df()[["dok_id", "beteckning"]]
    rows = []
    for doc in texts.merge(catalogue, on="dok_id").itertuples():
        fetched = pd.Timestamp(doc.fetched_at).date().isoformat()
        prefix = len("sfs-" + doc.beteckning.replace(":", "-"))
        try:
            items = paragraphs(doc.text, sfs=doc.beteckning, name=f"SFS {doc.beteckning}",
                               fetched=fetched)
        except Exception as error:  # noqa: BLE001
            print(f"{doc.dok_id}: {error!r}")
            continue
        for item in items:
            rows.append({**item, "id": doc.dok_id + item["id"][prefix:], "dok_id": doc.dok_id,
                         "sfs": doc.beteckning, "fetched": fetched,
                         "source_hash": doc.source_hash})
    frame = pd.DataFrame(rows).reindex(columns=COLUMNS)
    frame["stycke"] = frame["stycke"].astype("Int64")
    return frame
