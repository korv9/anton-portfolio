"""Every article, recital and annex of every fetched version of the AI Act, in each language.

A dbt Python model: the XHTML is parsed with platform/legal/parse.py (tested in
platform/tests/legal), which follows the ELI ids every rendering shares. One row per version ×
language × provision, with the text verbatim (white space aside), its chapter and section, the
amending acts named by the consolidated text's markers, and the other articles and annexes the
text refers to (`article_refs`, `annex_refs`: derived by pattern, not legal analysis).

Versions: the Official Journal text (CELEX 32024R1689) and each consolidated version
(02024R1689-<date>); amending acts are parsed elsewhere. The model fails if a version has no
articles, which means the parser no longer matches the source.
"""
import json
import sys
from pathlib import Path

import pandas as pd

VERSIONS = ("32024R1689", "02024R1689-")


def model(dbt, session):
    dbt.config(materialized="table")
    sys.path.insert(0, str(Path.cwd()))
    from legal.parse import annex_references, article_references, parse_act

    rows = []
    texts = dbt.ref("stg_ai_act_texts").df()
    for text in texts.itertuples():
        if not text.celex.startswith(VERSIONS):
            continue
        act = parse_act(text.xhtml)
        if not act.articles:
            raise ValueError(f"No articles parsed from {text.path}")
        for position, p in enumerate(act.provisions):
            refs = [r for r in article_references(p.text) if not (p.kind == "article" and r == p.number)]
            rows.append({
                "version_celex": text.celex,
                "language": text.language,
                "provision_id": p.provision_id,
                "provision_kind": p.kind,
                "number": p.number,
                "position": position,
                "title": p.title,
                "chapter": p.chapter,
                "chapter_title": p.chapter_title,
                "section": p.section,
                "section_title": p.section_title,
                "text": p.text,
                "text_hash": p.text_hash,
                "char_count": len(p.text),
                "amended_by": json.dumps(sorted({a["act"] for a in p.amendments})),
                "amendment_actions": json.dumps(sorted({a["action"] for a in p.amendments})),
                "article_refs": json.dumps(refs if text.language == "en" else []),
                "annex_refs": json.dumps(annex_references(p.text) if text.language == "en" else []),
                "source_hash": text.source_hash,
                "source_url": text.source_url,
                "retrieved_at": text.retrieved_at,
            })
    return pd.DataFrame(rows)
