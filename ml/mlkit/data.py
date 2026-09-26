"""Loaders for the delivered data the models train on.

This is the only place the ML layer touches the rest of the repository, and it reads
delivered artefacts rather than reaching into the platform's internals. Document shards
live in object storage, so they are fetched through the platform's delivery module and
cached under ml/.cache, which is gitignored.

Raw job advertisement text never leaves this process. Only aggregates are written out.
"""
from __future__ import annotations

import json
import re
import sys
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PUBLIC = ROOT / "frontend/public/data"
GOLD = PUBLIC / "gold/tables"
CACHE = ROOT / "ml/.cache"

sys.path.insert(0, str(ROOT / "platform/lib"))
import delivery  # noqa: E402


def gold(name: str):
    return json.loads((GOLD / f"{name}.json").read_text(encoding="utf-8"))


def _cached(relative: str) -> bytes:
    """Fetch a delivered shard once and keep it, so a rerun does not re-download 388 MB."""
    target = CACHE / relative
    if target.is_file():
        return target.read_bytes()
    content = delivery.read_bytes(relative)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(content)
    return content


def _unwrap(payload):
    return payload.get("data", payload) if isinstance(payload, dict) else payload


def _normalise_title(title: str) -> str:
    return re.sub(r"\W+", "", (title or "").lower())[:45]


def _normalise_speaker(speaker: str) -> str:
    """Name without party suffix, title prefix or 'replik', for rows without a person id."""
    name = re.sub(r"\s*\([^)]*\).*$", "", speaker or "")
    words = [w for w in name.split() if not re.search(r"(minister|ministe|rådet|talman)", w, re.I)]
    return " ".join(words).lower()


def committee_by_title() -> dict[str, str]:
    """Committee per decision-point title, keeping only titles that map to exactly one.

    This is the label supply for the policy-area model. A title used by two committees is
    dropped rather than resolved, because guessing would manufacture a label.
    """
    seen: dict[str, set[str]] = defaultdict(set)
    for row in gold("fact_decision_point"):
        seen[_normalise_title(row["title"])].add(row["committee"])
    return {title: next(iter(codes)) for title, codes in seen.items() if len(codes) == 1}


def issue_passages() -> list[dict]:
    """Issue-debate speeches carrying a committee label, for training the policy model.

    Sections whose title matches no decision point, or matches several, are excluded and
    counted by the caller rather than silently dropped.
    """
    lookup = committee_by_title()
    index = _unwrap(json.loads((PUBLIC / "politics/parliament/issues/index.json")
                               .read_text(encoding="utf-8")))
    sections = []
    for session in index:
        listing = _unwrap(json.loads(_cached("politics/parliament/" + session["index_path"])))
        for section in listing:
            committee = lookup.get(_normalise_title(section["debate_title"]))
            if committee:
                sections.append({**section, "committee": committee,
                                 "session": session["session"]})

    def load(section):
        speeches = _unwrap(json.loads(_cached("politics/parliament/" + section["path"])))
        low, high = int(section["first_speech_number"]), int(section["last_speech_number"])
        return [
            {"text": speech["speech_text"], "committee": section["committee"],
             "section_id": section["section_id"], "session": section["session"],
             "party": speech.get("party", ""), "speaker": speech.get("speaker", "")}
            for speech in speeches
            if low <= int(speech.get("speech_number", -1)) <= high
            and len(speech.get("speech_text", "")) > 200
        ]

    with ThreadPoolExecutor(max_workers=delivery.workers()) as pool:
        return [row for batch in pool.map(load, sections) for row in batch]


def party_speeches(sessions: list[str] | None = None) -> list[dict]:
    """Every speech card with a party label, issue debates and party-leader debates alike.

    Read from the speech index the site serves, Parquet with one part per session. Sessions
    are spelled '2025/26' inside the files; the partition folders use '2025-26', so hive
    partitioning is off to keep the spelling the rest of the repository uses.
    """
    import duckdb

    source = (PUBLIC / "parquet/speech_cards/*/*.parquet").as_posix()
    query = f"""
        select speech_id, party, speaker, session, kind, path, first, last, speech_number
        from read_parquet('{source}', hive_partitioning = false)
        where party is not null and party not in ('', '-')
    """
    rows = duckdb.sql(query).fetchall()
    columns = ["speech_id", "party", "speaker", "session", "kind", "path", "first", "last",
               "speech_number"]
    wanted = set(sessions) if sessions is not None else None
    return [dict(zip(columns, row)) for row in rows if wanted is None or row[3] in wanted]


def speech_texts(cards: list[dict]) -> list[dict]:
    """Full text for speech cards, fetched from the delivered shards and cached."""
    by_path: dict[str, list[dict]] = defaultdict(list)
    for card in cards:
        by_path[card["path"]].append(card)

    def load(path):
        speeches = {s["speech_id"]: s for s in
                    _unwrap(json.loads(_cached("politics/parliament/" + path)))}
        out = []
        for card in by_path[path]:
            speech = speeches.get(card["speech_id"])
            if speech and len(speech.get("speech_text", "")) > 200:
                # The speaker string varies for one person across titles and sessions
                # ('Statsrådet ULF KRISTERSSON (M) replik', 'Ulf Kristersson'), so the
                # Riksdag's person id is the grouping key. The name is the fallback.
                person = (speech.get("person_id") or "").strip()
                out.append({**card, "text": speech["speech_text"],
                            "person": person or _normalise_speaker(card["speaker"])})
        return out

    with ThreadPoolExecutor(max_workers=delivery.workers()) as pool:
        return [row for batch in pool.map(load, list(by_path)) for row in batch]
