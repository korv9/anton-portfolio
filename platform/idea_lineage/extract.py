"""Turn one final, user-visible assistant answer into candidate Idea Lineage events.

    python platform/idea_lineage/extract.py --input answer.txt          # review: show only
    python platform/idea_lineage/extract.py --input answer.txt --apply  # append
    pbpaste | python platform/idea_lineage/extract.py --mode auto

The text is read, never stored. Only short structured fields reach the journal, plus a SHA-256
of the answer so the same answer is not extracted twice. Precision over recall: an event is
taken only from what the answer marks itself, never mined from prose.

1. A fenced ```idea-lineage block holding a JSON event or list of events.
2. A labelled line: "Decision: …", "Idea: …", "Hypothesis: …", "Experiment: …", "Finding: …",
   "Open question: …", "Rejected: …" (and the Swedish labels).
3. A heading naming one of those kinds ("## Decisions", "### Öppna frågor"), whose bullets
   become events of that kind.

A decision written with hedges ("could", "would", "kanske") is kept as an idea, certainty
proposed. A finding without a number is tentative. Anything that looks like a conversation
export (speaker turns, a messages array) is refused.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import store  # noqa: E402
from schema import ALL_TYPES, MAX_TEXT, MAX_TITLE, RELATIONS  # noqa: E402

LABELS = {
    "idea": ["idea", "idé", "ide", "proposal", "förslag"],
    "decision": ["decision", "decisions", "beslut"],
    "hypothesis": ["hypothesis", "hypotheses", "hypotes", "hypoteser"],
    "experiment": ["experiment", "experiments"],
    "finding": ["finding", "findings", "result", "results", "fynd", "resultat", "lärdom"],
    "question": ["open question", "open questions", "question", "questions", "öppen fråga",
                 "öppna frågor", "fråga", "frågor"],
    "rejection": ["rejected", "rejection", "abandoned", "not building", "avfärdat",
                  "valde bort", "skippar"],
    "implementation": ["implementation", "implemented", "implementerat"],
    "observation": ["observation", "observations", "noterat"],
}
LABEL_TO_TYPE = {label: kind for kind, labels in LABELS.items() for label in labels}
_LABEL_RE = "|".join(sorted((re.escape(x) for x in LABEL_TO_TYPE), key=len, reverse=True))
LINE_RE = re.compile(rf"^\s*(?:[-*•]\s+)?\**({_LABEL_RE})\**\s*[:：]\s*\**\s*(.+)$", re.I)
HEADING_RE = re.compile(rf"^\s*#{{1,6}}\s+({_LABEL_RE})\s*:?\s*$", re.I)
BULLET_RE = re.compile(r"^\s*(?:[-*•]|\d+[.)])\s+(.+)$")
FENCE_RE = re.compile(r"```idea-lineage\s*\n(.*?)```", re.S)
HEDGES = re.compile(
    r"\b(maybe|perhaps|possibly|could|would|might|should we|suggest|recommend|propose|consider|"
    r"kanske|skulle|möjligen|eventuellt|föreslår|rekommenderar|kan vi|borde)\b", re.I)
REASON_RE = re.compile(r"\s+(?:because|since|as|eftersom|för att|då)\s+(.+)$", re.I)
CONVERSATION_RE = re.compile(r"^\s*(user|human|assistant|ai|claude|chatgpt|du|jag)\s*:", re.I | re.M)
REL_RE = re.compile(r"\b(%s)\s+((?:%s)-\d{4}-\d{2}-\d{2}-\d{3})" % (
    "|".join(r.replace("_", "[ _]") for r in RELATIONS), "|".join(ALL_TYPES)), re.I)
ANY_ID_RE = re.compile(r"\b((?:%s)-\d{4}-\d{2}-\d{2}-\d{3})\b" % "|".join(ALL_TYPES))
TAGS = {
    "data-quality": ["data quality", "datakvalitet", "quality"],
    "validity": ["validity", "validitet", "construct"],
    "clustering": ["cluster", "klust", "hdbscan", "umap"],
    "semantic-search": ["embedding", "semantic", "inbäddning"],
    "regulation": ["ai act", "regulation", "förordning", "obligation"],
    "concepts": ["concept", "begrepp"],
    "lineage": ["lineage", "provenance", "härkomst"],
    "portfolio-design": ["homepage", "design system", "start page", "portfolio"],
    "ux": ["visitor", "navigation", "layout", "mobile"],
}
STOP = set("the a an and or of to in on for with is are be this that it as by at from we our "
           "och att det som en ett i på för med är av till den de vi om".split())


def tokens(text: str) -> set[str]:
    return {t for t in re.findall(r"[\wåäö]+", text.lower()) if t not in STOP and len(t) > 2}


def similarity(a: str, b: str) -> float:
    x, y = tokens(a), tokens(b)
    return len(x & y) / len(x | y) if x and y else 0.0


def looks_like_conversation(text: str) -> bool:
    stripped = text.lstrip()
    if stripped.startswith(("{", "[")):
        try:
            data = json.loads(stripped)
        except json.JSONDecodeError:
            return False
        blob = json.dumps(data)[:20000]
        return '"role"' in blob or '"messages"' in blob or '"conversation"' in blob
    return len(CONVERSATION_RE.findall(text)) >= 2


def _clip(text: str, limit: int) -> str:
    text = re.sub(r"\s+", " ", text).strip().strip("*_ ")
    if len(text) <= limit:
        return text
    cut = text[:limit].rsplit(" ", 1)[0]
    return cut.rstrip(",;:") + "…"


def _summary(text: str) -> str:
    parts = re.split(r"(?<=[.!?])\s+", re.sub(r"\s+", " ", text).strip())
    return _clip(" ".join(parts[:4]), MAX_TEXT)


def detect_projects(text: str, names: dict[str, list[str]]) -> list[str]:
    low = text.lower()
    return sorted(p for p, aliases in names.items()
                  if any(re.search(rf"(?<![\w-]){re.escape(a.lower())}(?![\w-])", low) for a in aliases))


def detect_tags(text: str) -> list[str]:
    low = text.lower()
    return sorted(tag for tag, words in TAGS.items() if any(w in low for w in words))


def candidates(text: str) -> list[tuple[str, str]]:
    """(kind, item text) pairs marked in the answer, in order, before any classification."""
    found = []
    section = None
    for line in FENCE_RE.sub("", text).splitlines():
        if m := HEADING_RE.match(line):
            section = LABEL_TO_TYPE[m.group(1).lower()]
            continue
        if line.lstrip().startswith("#"):
            section = None
            continue
        if m := LINE_RE.match(line):
            found.append((LABEL_TO_TYPE[m.group(1).lower()], m.group(2)))
        elif section and (m := BULLET_RE.match(line)):
            found.append((section, m.group(1)))
        elif not line.strip():
            continue
        elif section and not line.startswith((" ", "\t")):
            section = None
    return found


def classify(kind: str, item: str) -> dict:
    """Type, certainty and status for one marked item, never stronger than its wording."""
    hedged = bool(HEDGES.search(item))
    if kind == "decision" and hedged:
        return {"type": "idea", "certainty": "proposed", "status": "active"}
    if kind == "finding":
        return {"type": "finding", "status": "active",
                "certainty": "confirmed" if re.search(r"\d", item) and not hedged else "tentative"}
    if kind == "question":
        return {"type": "question", "status": "open"}
    if kind == "idea" or hedged:
        return {"type": kind, "certainty": "proposed", "status": "active"}
    if kind == "rejection":
        return {"type": "rejection", "status": "completed", "certainty": "confirmed"}
    return {"type": kind, "status": "active", "certainty": "confirmed"}


def _relations(item: str, known: set[str]) -> dict[str, list[str]]:
    rels: dict[str, list[str]] = {}
    for verb, target in REL_RE.findall(item):
        rel = verb.lower().replace(" ", "_")
        if target in known:
            rels.setdefault(rel, []).append(target)
    named = {t for ts in rels.values() for t in ts}
    for target in ANY_ID_RE.findall(item):
        if target in known and target not in named:
            rels.setdefault("related_to", []).append(target)
    return rels


def build(text: str, existing: list[dict], day: str, created_at: str,
          default_projects: list[str] | None = None, visibility: str = "private") -> tuple[list[dict], list[str]]:
    """(new events, notes on what was skipped). Reads only `text`; keeps only fields."""
    names = store.projects()
    digest = hashlib.sha256(text.encode("utf-8")).hexdigest()
    if any((e.get("source") or {}).get("output_sha256") == digest for e in existing):
        return [], ["this answer was extracted before (same SHA-256); nothing new"]
    taken = {e["id"] for e in existing}
    known = set(taken)
    whole = detect_projects(text, names)
    fallback = default_projects or (whole if len(whole) == 1 else [])
    source = {"kind": "assistant_output", "session_date": day, "output_sha256": digest}
    raw = [(k, i) for k, i in candidates(text)]
    for block in FENCE_RE.findall(text):
        try:
            data = json.loads(block)
        except json.JSONDecodeError:
            continue
        for d in data if isinstance(data, list) else [data]:
            if isinstance(d, dict) and d.get("type") in ALL_TYPES and d.get("title"):
                raw.append((d["type"], d))
    events, notes = [], []
    recent = [e for e in existing if e["created_at"][:10] >= _days_before(day, 30)]
    for kind, item in raw:
        if isinstance(item, dict):
            fields = {k: v for k, v in item.items() if k in {
                "title", "summary", "reason", "projects", "tags", "importance", "status",
                "certainty", "relations", "open_questions", "implementation", "occurred_on",
                "question", "hypothesis", "method", "result", "interpretation", "limitations"}}
            text_for_match = " ".join(str(fields.get(k, "")) for k in ("title", "summary"))
            event = {"type": kind, **classify(kind, text_for_match), **fields}
        else:
            reason = REASON_RE.search(item)
            body = item[:reason.start()] if reason else item
            title = re.split(r"(?<=[.!?])\s+|\s+[—–-]\s+|:\s", body.strip(), maxsplit=1)[0]
            event = {**classify(kind, item), "title": _clip(title, MAX_TITLE),
                     "summary": _summary(item) if len(item) > len(title) + 3 else None,
                     "reason": _clip(reason.group(1), MAX_TEXT) if reason else None,
                     "relations": _relations(item, known)}
            text_for_match = item
        event["projects"] = event.get("projects") or detect_projects(text_for_match, names) or fallback
        event["tags"] = event.get("tags") or detect_tags(text_for_match)
        event.setdefault("importance", "normal")
        dup = _duplicate(event, recent + events)
        if dup and dup[1] >= 0.8:
            notes.append(f"skipped {event['type']} {event['title']!r}: same as {dup[0]['id']}")
            continue
        event["id"] = store.next_id(event["type"], day, taken)
        taken.add(event["id"])
        known.add(event["id"])
        event.update(created_at=created_at, visibility=visibility, source=source)
        if dup and dup[1] >= 0.5:
            event["inferred_relations"] = {"related_to": [dup[0]["id"]]}
            notes.append(f"{event['id']} looks related to {dup[0]['id']} (inferred, {dup[1]:.2f})")
        events.append({k: v for k, v in event.items() if v not in (None, [], {})})
    return events, notes


def _duplicate(event: dict, pool: list[dict]) -> tuple[dict, float] | None:
    best = None
    for e in pool:
        if e["type"] != event["type"]:
            continue
        score = similarity(event["title"] + " " + (event.get("summary") or ""),
                           e["title"] + " " + (e.get("summary") or ""))
        if best is None or score > best[1]:
            best = (e, score)
    return best if best and best[1] >= 0.5 else None


def _days_before(day: str, n: int) -> str:
    from datetime import date, timedelta

    return (date.fromisoformat(day) - timedelta(days=n)).isoformat()


def show(events: list[dict]) -> str:
    lines = []
    for e in events:
        tag = f"{e['type']}" + (f" ({e['certainty']})" if e.get("certainty") else "")
        lines.append(f"  {e['id']}  {tag}: {e['title']}")
        if e.get("projects"):
            lines.append(f"      projects: {', '.join(e['projects'])}")
        for rel, ts in {**e.get("relations", {}), **e.get("inferred_relations", {})}.items():
            lines.append(f"      {rel}: {', '.join(ts)}")
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--input", type=Path, help="file with the final answer (default: stdin)")
    ap.add_argument("--mode", choices=["review", "auto", "off"],
                    default=os.environ.get("IDEA_LINEAGE_MODE", "review"))
    ap.add_argument("--apply", action="store_true", help="append in review mode")
    ap.add_argument("--project", action="append", help="project id when the answer names none")
    ap.add_argument("--public", action="store_true", help="write to the public journal")
    args = ap.parse_args(argv)
    if args.mode == "off":
        return 0
    text = args.input.read_text(encoding="utf-8") if args.input else sys.stdin.read()
    if looks_like_conversation(text):
        print("refused: this looks like a conversation export. Pass only the final answer.",
              file=sys.stderr)
        return 2
    created = store.now()
    events, notes = build(text, store.read_events(), created[:10], created, args.project,
                          "public" if args.public else "private")
    for n in notes:
        print(f"note: {n}")
    if not events:
        print("No meaningful event marked in this answer; nothing to record.")
        return 0
    print(show(events))
    if args.mode == "auto" or args.apply:
        for path in sorted(set(store.append(events))):
            print(f"appended to {path.relative_to(store.ROOT) if path.is_relative_to(store.ROOT) else path}")
    else:
        print("review mode: nothing written. Run again with --apply to append.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
