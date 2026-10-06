"""The books as natural language, without Gutenberg's header and licence and without paratext.

A dbt Python model: the cleaning (platform/nlp/symbolic/cleaning.py, tested in
platform/tests/symbolic) needs the line breaks to find tables of contents, glossaries, indexes,
notes and bibliographies, and is clearer as small Python rules than as one SQL regex. White
space is collapsed afterwards, as before; case, punctuation and every kept word stay.

Each row carries its own cleaning audit: character counts before and after, the share removed,
the sections removed (kind:heading, as JSON) and the cleaning version. The model fails when a
book would lose more than half its text, which means a rule misfired.
"""
import json
import sys
from pathlib import Path

import pandas as pd


def model(dbt, session):
    dbt.config(materialized="table")
    sys.path.insert(0, str(Path.cwd() / "nlp" / "symbolic"))
    from cleaning import CLEANING_VERSION, clean_document

    rows = []
    for doc in dbt.ref("stg_symbolic_documents").df().itertuples():
        result = clean_document(doc.raw_text, {"document_id": doc.document_id})
        rows.append({
            "document_id": doc.document_id,
            "title": doc.title,
            "author": doc.author,
            "tradition": doc.tradition,
            "language": doc.language,
            "source_hash": doc.source_hash,
            "clean_text": result.text,
            "word_count": len(result.text.split()),
            "characters_removed": result.raw_char_count - result.clean_char_count,
            "raw_char_count": result.raw_char_count,
            "body_char_count": result.body_char_count,
            "clean_char_count": result.clean_char_count,
            "removed_char_count": result.removed_char_count,
            "removed_share": result.removed_share,
            "sections_removed": json.dumps(result.sections_removed, ensure_ascii=False),
            "footnote_blocks_removed": sum(r.kind == "footnote" for r in result.removals),
            "cleaning_warnings": json.dumps(result.warnings, ensure_ascii=False),
            "cleaning_version": CLEANING_VERSION,
        })
    return pd.DataFrame(rows)
