"""What changed between the Official Journal text and the current consolidated version.

Provision by provision (articles and annexes, English): inserted, deleted, amended, unchanged,
or `text_differs` when the texts differ but the consolidated text names no amending act (a
corrigendum, or a difference in rendering), which is reported as such and never as an
amendment. The comparison folds white space and quote styles and leaves out footnote numbers;
see platform/legal/parse.py.
"""
import json
import sys
from pathlib import Path

import pandas as pd

BASE = "32024R1689"


def model(dbt, session):
    dbt.config(materialized="table")
    sys.path.insert(0, str(Path.cwd()))
    from legal.parse import compare, parse_act

    texts = dbt.ref("stg_ai_act_texts").df()
    documents = dbt.ref("int_ai_act_documents").df()
    current = documents.loc[documents["is_current"], "celex"].iloc[0]
    en = texts[texts["language"] == "en"].set_index("celex")
    old, new = parse_act(en.loc[BASE, "xhtml"]), parse_act(en.loc[current, "xhtml"])
    rows = []
    for r in compare(old, new):
        rows.append({
            "from_version": BASE,
            "to_version": current,
            "provision_id": r["provision_id"],
            "provision_kind": r["kind"],
            "number": r["number"],
            "title": r["title"],
            "change_type": r["change"],
            "amended_by": json.dumps(r["acts"]),
            "amendment_actions": json.dumps(r["actions"]),
            "old_hash": r["old_hash"],
            "new_hash": r["new_hash"],
        })
    return pd.DataFrame(rows)
