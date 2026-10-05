"""One row per symbol word in the corpus, with the sentences around it.

A dbt Python model: sentence splitting and context windows are clearer in Python than in SQL,
and the result stays a table in DuckDB like every other silver model. The extraction itself is
platform/nlp/symbolic/context.py (tested in platform/tests/symbolic).
"""
import sys
from pathlib import Path

import pandas as pd


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
    columns = ["occurrence_id", "document_id", "symbol_id", "matched_term", "sentence",
               "previous_sentence", "next_sentence", "context", "tradition", "char_start",
               "char_end"]
    return pd.DataFrame(rows, columns=columns)
