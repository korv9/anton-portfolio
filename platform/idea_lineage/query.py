"""Ask the journal questions. Reads only stored summaries, never anything else.

    python platform/idea_lineage/query.py search "construct validity"
    python platform/idea_lineage/query.py history concept-journey
    python platform/idea_lineage/query.py why book-centering

search ranks events by TF-IDF over title, summary, reason and tags. history lists, by date,
every event that mentions the term or a project of that id, plus what they link to. why walks
an event's links back to where it came from.
"""
from __future__ import annotations

import math
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import store  # noqa: E402
from extract import tokens  # noqa: E402
from views import effective, links, when  # noqa: E402


def _text(e: dict) -> str:
    return " ".join([e["title"], e.get("summary") or "", e.get("reason") or "", " ".join(e.get("tags") or []),
                     " ".join(e.get("projects") or [])] + [e.get(k) or "" for k in ("hypothesis", "result")])


def search(query: str, events: list[dict], top: int = 10) -> list[tuple[float, dict]]:
    docs = [Counter(tokens(_text(e))) for e in events]
    df = Counter(t for d in docs for t in d)
    q = tokens(query.replace("-", " "))
    scored = []
    for e, d in zip(events, docs):
        score = sum(d[t] * math.log(1 + len(events) / df[t]) for t in q if t in d)
        if score:
            scored.append((score / math.sqrt(sum(d.values())), e))
    return sorted(scored, key=lambda x: -x[0])[:top]


def history(term: str, events: list[dict]) -> list[dict]:
    t = term.lower()
    hits = {e["id"] for e in events if t in (e.get("projects") or [])}
    hits |= {e["id"] for _, e in search(term, events, top=20)}
    for src, _, target, conf in links(events):
        if conf == "explicit" and (src in hits or target in hits):
            hits |= {src, target}
    return sorted((e for e in events if e["id"] in hits), key=lambda e: (when(e), e["created_at"]))


def why(term: str, events: list[dict]) -> list[tuple[dict, str | None]]:
    by_id = {e["id"]: e for e in events}
    start = by_id.get(term) or next((e for _, e in search(term, events, top=1)), None)
    if not start:
        return []
    back = {}
    for src, rel, target, conf in links(events):
        if conf == "explicit":
            back.setdefault(src, []).append((rel, target))
    chain, seen, todo = [], set(), [(start["id"], None)]
    while todo:
        eid, rel = todo.pop()
        if eid in seen or eid not in by_id:
            continue
        seen.add(eid)
        chain.append((by_id[eid], rel))
        todo += [(t, r) for r, t in back.get(eid, [])]
    return sorted(chain, key=lambda x: (when(x[0]), x[0]["created_at"]))


def fmt(e: dict, status: str | None = None) -> str:
    d = when(e)
    head = f"{d}  {e['type'].capitalize()}: {e['title']}"
    if e.get("certainty") and e["certainty"] != "confirmed":
        head += f" ({e['certainty']})"
    if status and status not in ("active", "open", "completed"):
        head += f" [{status}]"
    return head


def main(argv: list[str]) -> int:
    if len(argv) < 2 or argv[0] not in {"search", "history", "why"}:
        print(__doc__)
        return 2
    cmd, term = argv[0], " ".join(argv[1:])
    events = store.read_events()
    view = effective(events)
    if cmd == "search":
        rows = [e for _, e in search(term, events)]
    elif cmd == "history":
        rows = history(term, events)
    else:
        chain = why(term, events)
        if chain:
            print(f"WHY: {chain[-1][0]['title']}" if chain[-1][0]["id"] == term else f"WHY ({term})")
        for e, rel in chain:
            print(("  ↓ " + rel.replace("_", " ") + "\n" if rel else "") + "  " + fmt(e, view[e["id"]]["effective_status"]))
        if not chain:
            print("No matching event.")
        return 0
    for e in rows:
        print(fmt(e, view[e["id"]]["effective_status"]))
        if e.get("summary"):
            print(f"            {e['summary']}")
    if not rows:
        print("No matching event.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
