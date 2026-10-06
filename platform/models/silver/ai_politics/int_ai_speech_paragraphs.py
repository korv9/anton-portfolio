"""Speech paragraphs that mention AI, with the analytical concepts they contain.

The gate and the concepts are the regular expressions in seeds/ai_politics/ai_politics_concepts.csv
(the `gate` rows decide whether a paragraph is about AI; the `framing` rows are looked for inside
those paragraphs only). Matching code: platform/nlp/text/concepts.py. A match means the words
occur, nothing more: it is a dictionary count, not a reading of the speech.
"""
import json
import sys
from pathlib import Path

import pandas as pd


def model(dbt, session):
    dbt.config(materialized="table")
    sys.path.insert(0, str(Path.cwd() / "nlp" / "text"))
    from concepts import Concept, match_paragraphs

    seeds = dbt.ref("ai_politics_concepts").df()
    gate = next(Concept.from_row(r.concept_id, r.pattern, bool(r.case_sensitive))
                for r in seeds.itertuples() if r.concept_id == "ai")
    named = next(Concept.from_row(r.concept_id, r.pattern, bool(r.case_sensitive))
                 for r in seeds.itertuples() if r.concept_id == "ai_act")
    framing = [Concept.from_row(r.concept_id, r.pattern, bool(r.case_sensitive))
               for r in seeds.itertuples() if r.kind == "framing"]

    speeches = dbt.ref("int_riksdag_speeches").df()
    # A cheap prefilter on the whole text before splitting into paragraphs.
    candidates = speeches[speeches["text"].str.contains(gate.pattern, na=False)]
    rows = []
    for s in candidates.itertuples():
        for p in match_paragraphs(s.text.split("\n"), gate, framing):
            rows.append({
                "speech_id": s.speech_id,
                "paragraph": p["paragraph"],
                "text": p["text"],
                "ai_terms": json.dumps(p["gate_terms"], ensure_ascii=False),
                "names_ai_act": bool(named.terms(p["text"])),
                "concepts": json.dumps(p["concepts"], ensure_ascii=False),
                "concept_count": len(p["concepts"]),
            })
    return pd.DataFrame(rows, columns=["speech_id", "paragraph", "text", "ai_terms", "names_ai_act",
                                       "concepts", "concept_count"])
