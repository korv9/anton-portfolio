"""The Idea Lineage event model and its validation.

An event is one idea, decision, hypothesis, experiment, finding or question, written once to the
append-only journal. Nothing here stores conversation text: the allowed keys are a closed list,
free text is capped in length, and keys that would hold a prompt, a transcript or hidden
reasoning are refused anywhere in an event.
"""
from __future__ import annotations

import re

TYPES = ["idea", "decision", "hypothesis", "experiment", "finding", "question"]
SECONDARY_TYPES = ["rejection", "implementation", "observation"]
ALL_TYPES = TYPES + SECONDARY_TYPES

IMPORTANCE = ["minor", "normal", "major"]
# Status as written; the effective status (superseded, answered, abandoned) is derived from later
# events in views.py, so an old line never needs editing.
STATUS = ["active", "open", "completed", "dormant", "abandoned"]
CERTAINTY = ["proposed", "tentative", "confirmed"]
VISIBILITY = ["private", "public"]

# A relation on event E reads "E <relation> target". New events point at older ones, so the
# natural forms look backwards (supersedes, tests, answers); the passive forms are accepted for
# manual links between events that both exist.
RELATIONS = [
    "inspired_by", "evolved_from", "supersedes", "replaces", "contradicts", "tests", "supports",
    "rejects", "implements", "answers", "results_from", "applies_to", "related_to",
    "evolved_into", "tested_by", "supported_by", "rejected_by", "implemented_as", "resulted_in",
]
INVERSE = {
    "evolved_into": "evolved_from", "tested_by": "tests", "supported_by": "supports",
    "rejected_by": "rejects", "implemented_as": "implements", "resulted_in": "results_from",
}

EXPERIMENT_FIELDS = ["question", "hypothesis", "method", "result", "interpretation", "limitations"]
IMPLEMENTATION_FIELDS = ["commit", "pr", "files", "route", "artifact", "run", "dataset"]
SOURCE_KINDS = ["assistant_output", "manual", "import"]

ALLOWED_KEYS = {
    "id", "created_at", "occurred_on", "type", "title", "summary", "reason", "projects", "tags",
    "importance", "status", "certainty", "visibility", "relations", "inferred_relations",
    "open_questions", "implementation", "source", *EXPERIMENT_FIELDS,
}
# Never persisted, at any depth. The closed ALLOWED_KEYS list already refuses them at the top
# level; this catches them nested inside implementation or source too.
FORBIDDEN_KEYS = {
    "prompt", "prompts", "user_message", "user_prompt", "message", "messages", "conversation",
    "transcript", "raw_response", "response", "assistant_output", "output_text", "raw_text",
    "chain_of_thought", "reasoning", "thinking", "scratchpad", "tool_calls", "tool_trace",
}

MAX_TITLE = 140
MAX_TEXT = 600
MAX_SENTENCES = 4
ID_RE = re.compile(r"^(%s)-(\d{4}-\d{2}-\d{2})-(\d{3})$" % "|".join(ALL_TYPES))
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def sentences(text: str) -> int:
    return len([s for s in re.split(r"(?<=[.!?])\s+", text.strip()) if s])


def _forbidden(value, path: str) -> list[str]:
    if isinstance(value, dict):
        out = [f"{path}.{k}: forbidden key" for k in value if k in FORBIDDEN_KEYS]
        for k, v in value.items():
            out += _forbidden(v, f"{path}.{k}")
        return out
    if isinstance(value, list):
        return [e for i, v in enumerate(value) for e in _forbidden(v, f"{path}[{i}]")]
    return []


def _text(event: dict, key: str, limit: int, errors: list[str]) -> None:
    value = event.get(key)
    if value is None:
        return
    if not isinstance(value, str) or not value.strip():
        errors.append(f"{key}: must be non-empty text")
    elif len(value) > limit:
        errors.append(f"{key}: {len(value)} characters, at most {limit}")
    elif key != "title" and sentences(value) > MAX_SENTENCES + 2:
        errors.append(f"{key}: too long for a summary ({sentences(value)} sentences)")


def validate(event: dict, known_ids: set[str], projects: set[str]) -> list[str]:
    """Every problem with one event, or []. `known_ids` holds the ids it may relate to."""
    errors = [f"{k}: unknown key" for k in event if k not in ALLOWED_KEYS]
    errors += _forbidden(event, "event")
    match = ID_RE.match(str(event.get("id", "")))
    if not match:
        errors.append(f"id: {event.get('id')!r} is not <type>-YYYY-MM-DD-NNN")
    elif match.group(1) != event.get("type"):
        errors.append("id: prefix differs from type")
    if event.get("type") not in ALL_TYPES:
        errors.append(f"type: {event.get('type')!r}")
    if not isinstance(event.get("created_at"), str):
        errors.append("created_at: missing")
    if event.get("occurred_on") is not None and not DATE_RE.match(str(event["occurred_on"])):
        errors.append("occurred_on: not YYYY-MM-DD")
    if not event.get("title"):
        errors.append("title: missing")
    _text(event, "title", MAX_TITLE, errors)
    for key in ["summary", "reason", *EXPERIMENT_FIELDS]:
        _text(event, key, MAX_TEXT, errors)
    for key, allowed in [("importance", IMPORTANCE), ("status", STATUS), ("certainty", CERTAINTY),
                         ("visibility", VISIBILITY)]:
        if event.get(key) is not None and event[key] not in allowed:
            errors.append(f"{key}: {event[key]!r} not in {allowed}")
    for p in event.get("projects") or []:
        if p not in projects:
            errors.append(f"projects: unknown project {p!r}")
    for key in ["tags", "open_questions"]:
        values = event.get(key) or []
        if not isinstance(values, list) or not all(isinstance(v, str) and len(v) <= MAX_TITLE * 2
                                                   for v in values):
            errors.append(f"{key}: must be a list of short strings")
    for key in ["relations", "inferred_relations"]:
        for rel, targets in (event.get(key) or {}).items():
            if rel not in RELATIONS:
                errors.append(f"{key}: unknown relation {rel!r}")
            for t in targets:
                if t not in known_ids:
                    errors.append(f"{key}.{rel}: no event {t!r}")
                if t == event.get("id"):
                    errors.append(f"{key}.{rel}: points at itself")
    impl = event.get("implementation") or {}
    errors += [f"implementation: unknown key {k!r}" for k in impl if k not in IMPLEMENTATION_FIELDS]
    source = event.get("source") or {}
    if source and source.get("kind") not in SOURCE_KINDS:
        errors.append(f"source.kind: {source.get('kind')!r}")
    errors += [f"source: unknown key {k!r}" for k in source
               if k not in {"kind", "session_date", "output_sha256"}]
    return errors
