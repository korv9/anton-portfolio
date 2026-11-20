"""One topic's Riksdag debates as retrieval passages for the debate simulator (Replik).

    python platform/ingest/riksdagen/debate_corpus.py configs/debate/migration.json

Reads bronze.stg_riksdag_speeches (models/bronze/ai_politics/stg_riksdag_speeches.py) read-only
and writes warehouse/debate/<topic>/passages.jsonl and manifest.json. Nothing is uploaded.

The topic spec names a period, the kinds of debate and a regex on the debate title. A debate is
one section of a protocol (protocol_id + debate_title); its id is the protocol and the number of
its first speech. Only speeches by the eight parties are kept, under the party Riksdagen wrote
for the speech.

Each speech is packed into passages of whole paragraphs up to MAX_WORDS; a longer paragraph is
split between sentences, never inside one, so a negation stays with its claim. A tail under
MIN_WORDS joins the passage before it, which can then run to MAX_WORDS + MIN_WORDS. `text` is the source text unchanged; `search_text` only drops the
address to the chair ("Fru talman!") for embedding and keyword search.

`role` is "government" when the speaker field starts with a minister's title (Riksdagen's export
has no title field), otherwise "member". For a reply, `responds_to` is the latest earlier speech
in the same debate by another speaker, which is how a replikskifte runs in the chamber; the rule
is inferred, not a source field, and is named in the manifest. `context` is the first sentence
of that speech, so a passage shows what it answers.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
from collections import Counter
from datetime import UTC, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
PARTIES = ("C", "KD", "L", "M", "MP", "S", "SD", "V")
MAX_WORDS, MIN_WORDS, CONTEXT_WORDS = 200, 40, 40
SENTENCE = re.compile(r"(?<=[.!?])\s+(?=[A-ZÅÄÖ0-9\"”–-])")
CHAIR = re.compile(r"^(?:(?:Herr|Fru) (?:förste |andre |tredje )?(?:vice )?talman|Ärade [^!]*)!\s*")
MINISTER = re.compile(r"^(?:Statsrådet|(?:\S+- och )?\S*ministern)\b")
RESPONDS_TO_RULE = "previous speech in the same debate by another speaker"


def words(text: str) -> int:
    return len(text.split())


def sentences(paragraph: str) -> list[str]:
    return SENTENCE.split(paragraph)


def pack(text: str) -> list[str]:
    """Whole paragraphs (or, for a long one, whole sentences) packed up to MAX_WORDS."""
    units = []  # (text, separator before it when joined to the previous unit)
    for paragraph in filter(str.strip, text.split("\n")):
        parts = [paragraph] if words(paragraph) <= MAX_WORDS else sentences(paragraph)
        units.extend((part, "\n" if i == 0 else " ") for i, part in enumerate(parts))
    out: list[str] = []
    for unit, separator in units:
        if out and words(out[-1]) + words(unit) <= MAX_WORDS:
            out[-1] += separator + unit
        else:
            out.append(unit)
    if len(out) > 1 and words(out[-1]) < MIN_WORDS:
        tail = out.pop()
        out[-1] += "\n" + tail
    return out


def search_text(text: str) -> str:
    return CHAIR.sub("", text.strip())


def role(speaker: str) -> str:
    return "government" if MINISTER.match(speaker or "") else "member"


def committee(rel_dok_id: str | None) -> str | None:
    """'HC01SfU18' -> 'SfU'."""
    found = re.match(r"^H.\d\d([A-Za-zÅÄÖåäö]+?)\d", rel_dok_id or "")
    return found.group(1) if found else None


def first_sentence(text: str) -> str:
    sentence = sentences(search_text(text.split("\n")[0]) or text)[0]
    return " ".join(sentence.split()[:CONTEXT_WORDS])


def debates(rows: list[dict]) -> dict[tuple, list[dict]]:
    """Speeches by (protocol_id, debate_title), in protocol order."""
    out: dict[tuple, list[dict]] = {}
    for row in sorted(rows, key=lambda r: (r["protocol_id"], r["speech_number"])):
        out.setdefault((row["protocol_id"], row["debate_title"]), []).append(row)
    return out


def passages(speeches: list[dict]) -> list[dict]:
    """Passages of one debate. `speeches` holds every speaker, chair included, in order."""
    debate_id = f"{speeches[0]['protocol_id']}/{speeches[0]['speech_number']}"
    out = []
    for i, speech in enumerate(speeches):
        if speech["party_raw"] not in PARTIES:
            continue
        target = None
        if speech["is_reply"]:
            target = next((s for s in reversed(speeches[:i])
                           if s["speaker"] != speech["speaker"] and s["party_raw"] in PARTIES), None)
        for position, text in enumerate(pack(speech["text"])):
            out.append({
                "id": f"{speech['speech_id']}-{position}",
                "speech_id": speech["speech_id"],
                "position": position,
                "debate_id": debate_id,
                "debate_title": speech["debate_title"],
                "debate_kind": speech["debate_kind"],
                "rel_dok_id": speech["rel_dok_id"],
                "committee": committee(speech["rel_dok_id"]),
                "date": str(speech["speech_date"]),
                "session": speech["session"],
                "party": speech["party_raw"],
                "speaker": speech["speaker"],
                "role": role(speech["speaker"]),
                "is_reply": bool(speech["is_reply"]),
                "responds_to": target["speech_id"] if target else None,
                "responds_to_party": target["party_raw"] if target else None,
                "context": first_sentence(target["text"]) if target else None,
                "text": text,
                "search_text": search_text(text),
                "words": words(text),
                "source_url": speech["source_url"],
            })
    return out


def load(database: Path, spec: dict) -> list[dict]:
    import duckdb

    query = """select speech_id, session, speech_date, protocol_id, debate_title, debate_kind,
                      rel_dok_id, speech_number, speaker, party_raw, is_reply, text, source_url
               from bronze.stg_riksdag_speeches
               where speech_date between ? and ? and debate_kind in ({})
                 and regexp_matches(lower(debate_title), ?)
                 and not regexp_matches(lower(debate_title), ?)""".format(
        ", ".join("?" for _ in spec["debate_kinds"]))
    params = [spec["from"], spec["to"], *spec["debate_kinds"], spec["title_include"],
              spec.get("title_exclude") or "$^"]
    with duckdb.connect(str(database), read_only=True) as con:
        cursor = con.execute(query, params)
        names = [d[0] for d in cursor.description]
        return [dict(zip(names, row)) for row in cursor.fetchall()]


def build(rows: list[dict], spec: dict) -> tuple[list[dict], dict]:
    grouped = debates(rows)
    out = [p for speeches in grouped.values() for p in passages(speeches)]
    speeches = {p["speech_id"]: p for p in out}
    per_debate = Counter()
    for speeches_in in grouped.values():
        per_debate[len({s["party_raw"] for s in speeches_in} & set(PARTIES))] += 1
    manifest = {
        "spec": spec,
        "passages": len(out),
        "speeches": len(speeches),
        "debates": len(grouped),
        "debates_by_party_count": dict(sorted(per_debate.items())),
        "parties": {party: {
            "speeches": sum(1 for p in speeches.values() if p["party"] == party),
            "replies": sum(1 for p in speeches.values() if p["party"] == party and p["is_reply"]),
            "government": sum(1 for p in speeches.values()
                              if p["party"] == party and p["role"] == "government"),
            "passages": sum(1 for p in out if p["party"] == party),
        } for party in PARTIES},
        "chunking": {"max_words": MAX_WORDS, "min_tail_words": MIN_WORDS, "overlap": 0,
                     "unit": "paragraph, split between sentences when longer"},
        "responds_to_rule": RESPONDS_TO_RULE,
        "role_rule": "speaker starts with Statsrådet or a minister title",
        "source": "bronze.stg_riksdag_speeches",
    }
    return out, manifest


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("spec", type=Path)
    parser.add_argument("--db", type=Path, default=ROOT / "warehouse" / "portfolio.duckdb")
    parser.add_argument("--out", type=Path, default=ROOT / "warehouse" / "debate")
    args = parser.parse_args()
    spec = json.loads(args.spec.read_text(encoding="utf-8"))
    out, manifest = build(load(args.db, spec), spec)
    if not out:
        raise SystemExit(f"No speeches match {args.spec}")
    folder = args.out / spec["topic"]
    folder.mkdir(parents=True, exist_ok=True)
    body = "".join(json.dumps(p, ensure_ascii=False) + "\n" for p in out)
    (folder / "passages.jsonl").write_text(body, encoding="utf-8", newline="\n")
    manifest["sha256"] = hashlib.sha256(body.encode("utf-8")).hexdigest()
    manifest["created"] = datetime.now(UTC).isoformat(timespec="seconds")
    (folder / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
                                          encoding="utf-8", newline="\n")
    print(f"{spec['topic']}: {manifest['debates']} debates, {manifest['speeches']} speeches, "
          f"{len(out)} passages -> {folder}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
