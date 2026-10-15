"""One row per paragraph (§) of every SFS document fetched, or per stycke of a long one.

The split of silver_sfs_paragraphs (platform/ingest/sfs/chunking.py) applied to the whole list in
raw/sfs/catalogue.json, repealed documents included. The id is the dok_id, which is unique where
the SFS number is not, and riksdagen.se's anchor K<chapter>P<§>S<stycke>: the split's own id reads
"2-5" both as 2 kap. 5 § and as 2 §, fifth stycke. A document the split gets nothing from, or
raises on, is counted in silver_sfs_documents.parse_status rather than dropped silently.

A document the split gets no paragraph from gets passages of kind 'whole_text' holding its body
(header and transitional provisions left out), packed by chunking.pack into pieces of at most
1,500 characters: id <dok_id>-whole when it fits in one, <dok_id>-whole-<n> otherwise. The 133
texts riksdagen.se serves as XML (OCR'd Riksbank and Riksgälden regulations and one 1869
ordinance) are left out: their OCR text is too poor to search.
"""
from pathlib import Path

import pandas as pd

COLUMNS = ["id", "kind", "dok_id", "sfs", "title", "avdelning", "chapter", "paragraph", "stycke", "text",
           "amended_by", "fetched", "source_hash"]


def anchor(item: dict) -> str:
    out = f"K{item['chapter']}" if item["chapter"] else ""
    out += f"P{item['paragraph']}" + (f"S{item['stycke']}" if item["stycke"] else "")
    return out.replace(" ", "")


def model(dbt, session):
    dbt.config(materialized="table")
    import sys
    sys.path.insert(0, str(Path.cwd() / "ingest" / "sfs"))
    from chunking import body, pack, paragraphs

    texts = dbt.ref("stg_sfs_texts").df()
    catalogue = dbt.source("sfs", "catalogue").df()[["dok_id", "beteckning"]]
    rows = []
    for doc in texts.merge(catalogue, on="dok_id").itertuples():
        fetched = pd.Timestamp(doc.fetched_at).date().isoformat()
        try:
            items = paragraphs(doc.text, sfs=doc.beteckning, name=f"SFS {doc.beteckning}",
                               fetched=fetched)
        except Exception as error:  # noqa: BLE001
            print(f"{doc.dok_id}: {error!r}")
            continue
        common = {"dok_id": doc.dok_id, "sfs": doc.beteckning, "fetched": fetched,
                  "source_hash": doc.source_hash}
        for item in items:
            rows.append({**item, **common, "id": f"{doc.dok_id}-{anchor(item)}",
                         "kind": "paragraph"})
        if items or doc.text.lstrip().startswith("<"):
            continue
        pieces = pack(body(doc.text))
        for number, piece in enumerate(pieces, 1):
            suffix = f"-{number}" if len(pieces) > 1 else ""
            rows.append({**common, "id": f"{doc.dok_id}-whole{suffix}", "kind": "whole_text",
                         "title": f"SFS {doc.beteckning}", "text": piece})
    frame = pd.DataFrame(rows).reindex(columns=COLUMNS)
    frame["stycke"] = frame["stycke"].astype("Int64")
    return frame
