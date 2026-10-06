"""Every document of the AI Act's family, one row each, from Cellar's latest answer.

A dbt Python model: Cellar answers as SPARQL JSON, read here with platform/legal/cellar.py.
Rows: the act itself, its consolidated versions, the acts amending and correcting it, the
proposals to amend it and the acts based on it. The document type is read from the CELEX
number (sector, form and suffix are the Publications Office's own scheme); that is the only
derived column, and `document_type_basis` says so.

Regulation versions (the Official Journal text and each consolidated version) get a validity
window: a version is valid from its Cellar date until the day before the next one, and the
newest is current. The dates are Cellar's, not interpreted.
"""
import html
import json
import re
import sys
from datetime import date, timedelta
from pathlib import Path

import pandas as pd

CELEX = "32024R1689"
CONSOLIDATED = "02024R1689-"


def document_type(celex: str, relation: str) -> str:
    if celex == CELEX:
        return "regulation"
    if celex.startswith(CONSOLIDATED):
        return "consolidated_version"
    if re.search(r"R\(\d+\)$", celex):
        return "corrigendum"
    if re.match(r"^3\d{4}R", celex):
        return "amending_regulation" if relation == "amends" else "regulation_based_on"
    if re.match(r"^3\d{4}D", celex):
        return "decision_based_on"
    if re.match(r"^5\d{4}PC", celex):
        return "original_proposal" if relation == "adopts" else "legislative_proposal"
    if re.match(r"^5\d{4}DC", celex):
        return "commission_document"
    if re.match(r"^5\d{4}IP", celex):
        return "parliament_resolution"
    return "other"


def model(dbt, session):
    dbt.config(materialized="table")
    sys.path.insert(0, str(Path.cwd()))
    from legal.cellar import eurlex_url, parse_related

    related = dbt.ref("stg_ai_act_related").df()
    latest = related[related["is_latest"] & (related["query"] == "related")].iloc[0]
    rows = [r for r in parse_related(json.loads(latest["answer_json"]))
            if r["relation"] != "consolidates" or r["celex"].startswith(CONSOLIDATED)]
    origin = related[related["is_latest"] & (related["query"] == "origin")]
    if len(origin):
        rows += parse_related(json.loads(origin.iloc[0]["answer_json"]))

    texts = dbt.ref("stg_ai_act_texts").df()
    languages = texts.groupby("celex")["language"].apply(lambda s: ",".join(sorted(s))).to_dict()
    retrieved = texts.groupby("celex")["retrieved_at"].min().to_dict()
    hashes = texts[texts["language"] == "en"].set_index("celex")["source_hash"].to_dict()

    # The act itself: its title from the Official Journal text, its date from its first
    # consolidated version (02024R1689-<publication date>).
    oj = texts[(texts["celex"] == CELEX) & (texts["language"] == "en")].iloc[0]["xhtml"]
    parts = re.findall(r'class="oj-doc-ti"[^>]*>(.*?)</p>', oj, re.S)[:3]
    title = " ".join(" ".join(html.unescape(re.sub(r"<[^>]+>", " ", t)).split()) for t in parts)
    first = min((r["date"] for r in rows if r["celex"].startswith(CONSOLIDATED) and r["date"]), default=None)
    documents = [{"celex": CELEX, "relation": "self", "date": first, "title": title}] + rows
    out = []
    for d in documents:
        dtype = document_type(d["celex"], d["relation"])
        out.append({
            "document_id": d["celex"],
            "celex": d["celex"],
            "relation": d["relation"],
            "document_type": dtype,
            "document_type_basis": "derived from the CELEX number",
            "title": d["title"] or ("Corrigendum to Regulation (EU) 2024/1689" if dtype == "corrigendum" else None),
            "title_basis": "Cellar" if d["title"] else ("derived from the CELEX number" if dtype == "corrigendum" else None),
            "published_at": pd.to_datetime(d["date"]).date() if d["date"] else None,
            "source_url": eurlex_url(d["celex"]),
            "cellar_answer_hash": latest["source_hash"],
            "cellar_retrieved_at": latest["last_fetched_at"],
            "text_languages": languages.get(d["celex"]),
            "text_retrieved_at": retrieved.get(d["celex"]),
            "version_hash": hashes.get(d["celex"]),
        })
    frame = pd.DataFrame(out)

    # Validity of the regulation's versions: the OJ text and each consolidated version.
    versions = frame[frame["document_type"].isin(["regulation", "consolidated_version"])]
    versions = versions[versions["celex"].str.startswith(CONSOLIDATED)].sort_values("published_at")
    frame["valid_from"] = None
    frame["valid_to"] = None
    frame["is_current"] = False
    dates = list(versions["published_at"])
    for i, celex in enumerate(versions["celex"]):
        mask = frame["celex"] == celex
        frame.loc[mask, "valid_from"] = dates[i]
        frame.loc[mask, "valid_to"] = dates[i + 1] - timedelta(days=1) if i + 1 < len(dates) else None
        frame.loc[mask, "is_current"] = i + 1 == len(dates)
    frame["valid_from"] = pd.to_datetime(frame["valid_from"]).dt.date
    frame["valid_to"] = pd.to_datetime(frame["valid_to"]).dt.date
    frame["published_at"] = pd.to_datetime(frame["published_at"]).dt.date
    return frame
