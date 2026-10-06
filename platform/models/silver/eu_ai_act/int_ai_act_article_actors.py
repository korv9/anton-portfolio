"""Which actors each current article mentions, and where the text says an actor "shall".

Derived by pattern from the current English text, with the patterns in
seeds/eu_ai_act/ai_act_actors.csv (`match_pattern`). Two counts per article and actor:
`mentions` (the term appears) and `duty_sentences` (a sentence where the term is followed,
within the same clause, by "shall"). This is a signal for navigation, not a legal reading:
an article can mention an actor without imposing anything on it.
"""
import re
import sys
from pathlib import Path

import pandas as pd

METHOD = "term-match-v1"


def model(dbt, session):
    dbt.config(materialized="table")
    sys.path.insert(0, str(Path.cwd()))

    provisions = dbt.ref("int_ai_act_provisions").df()
    documents = dbt.ref("int_ai_act_documents").df()
    actors = dbt.ref("ai_act_actors").df()
    current = documents.loc[documents["is_current"], "celex"].iloc[0]
    articles = provisions[(provisions["version_celex"] == current) & (provisions["language"] == "en")
                          & (provisions["provision_kind"] == "article")]
    rows = []
    for a in articles.itertuples():
        sentences = re.split(r"(?<=[.;:])\s+", a.text)
        for actor in actors.itertuples():
            pattern = re.compile(actor.match_pattern, re.I)
            mentions = len(pattern.findall(a.text))
            if not mentions:
                continue
            duty = sum(1 for s in sentences
                       if (m := pattern.search(s)) and re.search(r"\bshall\b", s[m.end():m.end() + 160]))
            rows.append({
                "article_number": a.number,
                "actor_id": actor.actor_id,
                "mentions": mentions,
                "duty_sentences": duty,
                "method": METHOD,
                "version_celex": current,
            })
    return pd.DataFrame(rows)
