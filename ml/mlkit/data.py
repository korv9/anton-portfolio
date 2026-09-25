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

    with ThreadPoolExecutor(max_workers=12) as pool:
        return [row for batch in pool.map(load, sections) for row in batch]


def leader_speeches(sessions: list[str] | None = None) -> list[dict]:
    """Party-leader debate speeches with a party label, for polarization and for applying
    the policy model. Read from the discovery index, which is already per-session JSON."""
    manifest = json.loads((PUBLIC / "discovery/index.json").read_text(encoding="utf-8"))
    wanted = [row for row in manifest if sessions is None or row["session"] in sessions]
    rows = []
    for entry in wanted:
        cards = json.loads((PUBLIC / "discovery" / Path(entry["path"]).name)
                           .read_text(encoding="utf-8"))
        rows.extend(
            {"speech_id": card["speech_id"], "party": card["party"],
             "speaker": card["speaker"], "session": card["session"],
             "kind": card["kind"], "excerpt": card["excerpt"], "path": card["path"],
             "first": card["first"], "last": card["last"], "speech_number": card["speech_number"]}
            for card in cards if card["party"] and card["party"] != "-"
        )
    return rows


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
                out.append({**card, "text": speech["speech_text"]})
        return out

    with ThreadPoolExecutor(max_workers=12) as pool:
        return [row for batch in pool.map(load, list(by_path)) for row in batch]
