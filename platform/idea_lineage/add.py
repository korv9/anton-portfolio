"""Record one event by hand, outside any conversation.

    python platform/idea_lineage/add.py --type idea --project symbolic-atlas \
        --title "Test translator centering"
    python platform/idea_lineage/add.py --type decision --title "…" --supersedes idea-2026-10-04-003

Related earlier events are suggested (inferred) but never block saving.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import store  # noqa: E402
from extract import detect_tags, similarity  # noqa: E402
from schema import (ALL_TYPES, CERTAINTY, EXPERIMENT_FIELDS, IMPORTANCE, RELATIONS,  # noqa: E402
                    STATUS)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--type", required=True, choices=ALL_TYPES)
    ap.add_argument("--title", required=True)
    ap.add_argument("--summary")
    ap.add_argument("--reason")
    ap.add_argument("--project", action="append", default=[])
    ap.add_argument("--tag", action="append", default=[])
    ap.add_argument("--importance", choices=IMPORTANCE, default="normal")
    ap.add_argument("--status", choices=STATUS)
    ap.add_argument("--certainty", choices=CERTAINTY)
    ap.add_argument("--occurred-on", help="YYYY-MM-DD, when it happened if not today")
    ap.add_argument("--open-question", action="append", default=[])
    ap.add_argument("--commit")
    ap.add_argument("--pr")
    ap.add_argument("--file", action="append", default=[])
    ap.add_argument("--public", action="store_true", help="publishable; default is private")
    for field in EXPERIMENT_FIELDS:
        ap.add_argument(f"--{field}")
    for rel in RELATIONS:
        ap.add_argument(f"--{rel.replace('_', '-')}", dest=f"rel_{rel}", action="append", default=[])
    args = ap.parse_args(argv)

    existing = store.read_events()
    created = store.now()
    event = {
        "id": store.next_id(args.type, created[:10], {e["id"] for e in existing}),
        "created_at": created, "occurred_on": args.occurred_on, "type": args.type,
        "title": args.title, "summary": args.summary, "reason": args.reason,
        "projects": args.project, "tags": args.tag or detect_tags(f"{args.title} {args.summary or ''}"),
        "importance": args.importance,
        "status": args.status or ("open" if args.type == "question" else "active"),
        "certainty": args.certainty, "open_questions": args.open_question,
        "visibility": "public" if args.public else "private",
        "relations": {r: getattr(args, f"rel_{r}") for r in RELATIONS if getattr(args, f"rel_{r}")},
        "implementation": {k: v for k, v in {"commit": args.commit, "pr": args.pr,
                                              "files": args.file}.items() if v},
        "source": {"kind": "manual", "session_date": created[:10]},
        **{f: getattr(args, f) for f in EXPERIMENT_FIELDS},
    }
    event = {k: v for k, v in event.items() if v not in (None, [], {})}
    related = sorted(((similarity(event["title"], e["title"]), e) for e in existing), key=lambda x: -x[0])
    store.append([event])
    print(f"added {event['id']} ({event['visibility']})")
    near = [(s, e) for s, e in related[:3] if s >= 0.3]
    if near:
        print("Related earlier events (not linked; add --related-to to link):")
        for s, e in near:
            print(f"  {e['id']}  {e['title']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
