"""The Philosophy Atlas's passages: each work's own text, cleaned and cut into passages.

A dbt Python model. Per work: the author's own text between the markers in corpus.json
(translators' and editors' introductions, biographies and notes left out;
nlp/philosophy/passages.py own_text), cleaned with the shared Gutenberg cleaning
(nlp/symbolic/cleaning.py), then cut into passages of about 60–220 words (passages.py).
One row per passage, verbatim.
"""
import json
import sys
from pathlib import Path

import pandas as pd


def model(dbt, session):
    dbt.config(materialized="table")
    sys.path.insert(0, str(Path.cwd() / "nlp" / "symbolic"))
    sys.path.insert(0, str(Path.cwd() / "nlp" / "philosophy"))
    from cleaning import clean_document
    from passages import own_text, passages

    rows = []
    for doc in dbt.ref("stg_philosophy_documents").df().itertuples():
        start = json.loads(doc.text_start) if isinstance(doc.text_start, str) else None
        end = json.loads(doc.text_end) if isinstance(doc.text_end, str) else None
        text, first, last = own_text(doc.raw_text, start, end)
        cleaned = clean_document(text, {"document_id": doc.document_id})
        for i, p in enumerate(passages(cleaned.structured)):
            rows.append({
                "passage_id": f"{doc.document_id}:{i}",
                "document_id": doc.document_id,
                "author": doc.author,
                "tradition": doc.tradition,
                "translator": doc.translator if isinstance(doc.translator, str) else None,
                "position": i,
                "text": p,
                "word_count": len(p.split()),
                "own_text_lines": f"{first}-{last}",
                "source_hash": doc.source_hash,
            })
    return pd.DataFrame(rows)
