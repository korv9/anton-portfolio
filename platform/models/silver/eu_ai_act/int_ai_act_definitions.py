"""The defined terms of Article 3 in the current English text: point, term, definition verbatim."""
import sys
from pathlib import Path

import pandas as pd


def model(dbt, session):
    dbt.config(materialized="table")
    sys.path.insert(0, str(Path.cwd()))
    from legal.parse import Provision, definitions

    provisions = dbt.ref("int_ai_act_provisions").df()
    documents = dbt.ref("int_ai_act_documents").df()
    current = documents.loc[documents["is_current"], "celex"].iloc[0]
    article = provisions[(provisions["version_celex"] == current) & (provisions["language"] == "en")
                         & (provisions["provision_id"] == "art_3")].iloc[0]
    provision = Provision("art_3", "article", "3", lines=article["text"].split("\n"))
    rows = [dict(d, version_celex=current) for d in definitions(provision)]
    return pd.DataFrame(rows)
