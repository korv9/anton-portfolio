"""Every Riksdag speech from the archives in warehouse/raw/riksdagen/speeches, one row each.

A dbt Python model, because the archives are zip files of one JSON document per speech, which
DuckDB cannot read as tables: the source reads each archive as bytes (read_blob) and this model
opens it. Fields are kept as Riksdagen wrote them (the party as written; silver
normalises it); the speech text is turned from HTML into plain paragraphs separated by newlines,
nothing else. Each row carries the archive it came from and that archive's SHA-256 from the fetch
log (platform/ingest/riksdagen/ingest_speeches.py).
"""
import io
import json
import zipfile
from pathlib import Path

import pandas as pd

COLUMNS = ["speech_id", "anforande_id", "session", "speech_date", "protocol_id", "protocol_title",
           "debate_title", "debate_kind", "speaker", "party_raw", "member_id", "is_reply",
           "text", "paragraph_count", "word_count", "source_url", "archive_path", "archive_hash"]


def model(dbt, session):
    dbt.config(materialized="table")
    import sys
    sys.path.insert(0, str(Path.cwd() / "nlp" / "text"))
    from concepts import paragraphs

    fetches = dbt.source("riksdagen_speeches", "fetches").df()
    fetches = fetches[fetches["path"].astype(str).str.startswith("speeches/")]
    hashes = fetches.sort_values("fetched_at").groupby("path")["sha256"].last().to_dict()
    rows = []
    archives = dbt.source("riksdagen_speeches", "archives").df().sort_values("filename")
    for archive in archives.itertuples():
        relative = "speeches/" + Path(str(archive.filename).replace("\\", "/")).name
        with zipfile.ZipFile(io.BytesIO(archive.content)) as z:
            for name in z.namelist():
                if not name.endswith(".json"):
                    continue
                s = json.loads(z.read(name).decode("utf-8-sig"))["anforande"]
                paras = paragraphs(s.get("anforandetext") or "")
                text = "\n".join(paras)
                rows.append({
                    "speech_id": f"{s['dok_id']}-{s['anforande_nummer']}",
                    "anforande_id": s.get("anforande_id"),
                    "session": s.get("dok_rm"),
                    "speech_date": (s.get("dok_datum") or "")[:10] or None,
                    "protocol_id": s.get("dok_id"),
                    "protocol_title": s.get("dok_titel"),
                    "debate_title": s.get("avsnittsrubrik"),
                    "debate_kind": s.get("kammaraktivitet"),
                    "speaker": s.get("talare"),
                    "party_raw": s.get("parti"),
                    "member_id": s.get("intressent_id"),
                    "is_reply": s.get("replik") == "Y",
                    "text": text,
                    "paragraph_count": len(paras),
                    "word_count": len(text.split()),
                    "source_url": f"https://data.riksdagen.se/anforande/{s['dok_id']}-{s['anforande_nummer']}/html",
                    "archive_path": relative,
                    "archive_hash": hashes.get(relative),
                })
    frame = pd.DataFrame(rows, columns=COLUMNS)
    frame["speech_date"] = pd.to_datetime(frame["speech_date"], errors="coerce").dt.date
    # One row per speech: a speech appears once per archive; keep the first if republished.
    return frame.drop_duplicates("speech_id")
