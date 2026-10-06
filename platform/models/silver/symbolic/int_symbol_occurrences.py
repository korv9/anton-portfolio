"""One row per symbol word in the corpus, with the sentences around it.

A dbt Python model: sentence splitting and context windows are clearer in Python than in SQL,
and the result stays a table in DuckDB like every other silver model. The extraction itself is
platform/nlp/symbolic/context.py (tested in platform/tests/symbolic).

Some books reprint others (Bulfinch retells the Mabinogion in Guest's words, one Serbian
collection reprints another). The same passage in two books would make a cluster look shared
across books when it is one text. So an occurrence whose sentence, folded to lower-case words,
also occurs in another book, and has at least DUPLICATE_MIN_WORDS words, keeps
`duplicate_of` set to the book it is kept in: the first by source type (a translation or
original before a collection, a collection before a retelling), then by document id. Every
occurrence stays in the table; the atlas sample (nlp/symbolic/pipeline.py) leaves duplicates out.
"""
import re
import sys
from pathlib import Path

import pandas as pd


DUPLICATE_MIN_WORDS = 8
SOURCE_ORDER = {"translation": 0, "primary-english": 0, "literary": 0, "folklore-collection": 1,
                "retelling": 2}


def model(dbt, session):
    dbt.config(materialized="table")
    sys.path.insert(0, str(Path.cwd() / "nlp" / "symbolic"))
    from context import extract

    documents = dbt.ref("int_symbolic_documents").df()
    aliases = dbt.ref("symbol_aliases").df()
    lookup = {a.lower(): s for s, a in zip(aliases["symbol_id"], aliases["alias"])}
    rows = []
    for doc in documents.itertuples():
        for occ in extract(doc.document_id, doc.clean_text, lookup):
            rows.append({**occ.__dict__, "tradition": doc.tradition})
    priority = {d.document_id: (SOURCE_ORDER.get(d.source_type, len(SOURCE_ORDER)), d.document_id)
                for d in documents.itertuples()}
    keeper: dict[tuple, str] = {}
    for row in rows:
        words = re.findall(r"[a-z0-9]+", row["sentence"].lower())
        row["_key"] = (row["symbol_id"], " ".join(words)) if len(words) >= DUPLICATE_MIN_WORDS else None
        if row["_key"] is not None:
            current = keeper.get(row["_key"])
            if current is None or priority[row["document_id"]] < priority[current]:
                keeper[row["_key"]] = row["document_id"]
    for row in rows:
        kept = keeper.get(row.pop("_key")) if row.get("_key") is not None else None
        row["duplicate_of"] = kept if kept and kept != row["document_id"] else None
    columns = ["occurrence_id", "document_id", "symbol_id", "matched_term", "sentence",
               "previous_sentence", "next_sentence", "context", "tradition", "char_start",
               "char_end", "duplicate_of"]
    return pd.DataFrame(rows, columns=columns)
