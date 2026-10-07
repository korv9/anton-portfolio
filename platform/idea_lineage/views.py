"""Views derived from the journal: project state, portfolio summary, agent context, diary and
weekly digest. All of them can be deleted and rebuilt; the journal is the only history.

    python platform/idea_lineage/views.py [state|diary|digest|export|all]

Writes into the private home (state/, diary/, digests/, context.json) and, for `export`, the
public events the site may show (frontend/public/data/idea-lineage/events.json).
"""
from __future__ import annotations

import json
import sys
from collections import Counter, defaultdict
from datetime import date
from itertools import combinations
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import store  # noqa: E402
from schema import INVERSE  # noqa: E402

HEADER = "<!-- Generated from the Idea Lineage journal. Do not edit; run npm run ideas:build. -->\n"
EXPORT = store.ROOT / "frontend/public/data/idea-lineage/events.json"
PUBLIC_FIELDS = ["id", "created_at", "occurred_on", "type", "title", "summary", "reason", "projects",
                 "tags", "importance", "certainty", "relations", "implementation", "question",
                 "hypothesis", "method", "result", "interpretation", "limitations"]
# What a later event's relation does to the earlier event it points at.
ENDS = {"supersedes": "superseded", "replaces": "superseded", "evolved_from": "evolved",
        "rejects": "abandoned", "answers": "answered"}


def links(events: list[dict]) -> list[tuple[str, str, str, str]]:
    """(source, relation, target, confidence), passive forms turned to their active reading."""
    out = []
    for e in events:
        for key, conf in [("relations", "explicit"), ("inferred_relations", "inferred")]:
            for rel, targets in (e.get(key) or {}).items():
                for t in targets:
                    if rel in INVERSE:
                        out.append((t, INVERSE[rel], e["id"], conf))
                    else:
                        out.append((e["id"], rel, t, conf))
    return out


def effective(events: list[dict]) -> dict[str, dict]:
    """Each event with its current status and the event that changed it, if any."""
    by_id = {e["id"]: dict(e) for e in events}
    for e in by_id.values():
        e["effective_status"] = e.get("status") or ("open" if e["type"] == "question" else "active")
    for src, rel, target, conf in links(events):
        if conf == "explicit" and rel in ENDS and target in by_id:
            by_id[target]["effective_status"] = ENDS[rel]
            by_id[target]["changed_by"] = src
    return by_id


def when(e: dict) -> str:
    return e.get("occurred_on") or e["created_at"][:10]


def long_date(day: str) -> str:
    d = date.fromisoformat(day)
    return f"{d.day} {d.strftime('%B %Y')}"


def project_names() -> dict[str, str]:
    names = store.projects()
    labels = {p: next((a for a in aliases[2:] if a[:1].isupper()), aliases[1].capitalize())
              for p, aliases in names.items()}
    return {**labels, "politics": "Politics", store.PORTFOLIO: "Portfolio"}


def _line(e: dict, with_date: bool = True) -> str:
    bits = [f"- {e['title']}"]
    if e.get("certainty") and e["certainty"] != "confirmed":
        bits.append(f" *({e['certainty']})*")
    if with_date:
        bits.append(f" — {when(e)}, `{e['id']}`")
    if e.get("summary"):
        bits.append(f"\n  {e['summary']}")
    return "".join(bits)


def _section(title: str, items: list[dict], empty: str | None = None, **kw) -> list[str]:
    if not items and empty is None:
        return []
    return [f"## {title}", *([_line(e, **kw) for e in items] or [empty]), ""]


def project_state(pid: str, view: dict[str, dict], label: str) -> str:
    mine = sorted((e for e in view.values() if pid in (e.get("projects") or [])), key=when)
    live = [e for e in mine if e["effective_status"] in ("active", "open", "completed")]
    decisions = [e for e in live if e["type"] == "decision"]
    # The direction comes from the project's own decisions (listed first), not from shared ones.
    own = [e for e in decisions if (e.get("projects") or [None])[0] == pid] or decisions
    direction = next((e for e in reversed(own) if e.get("importance") == "major"),
                     own[-1] if own else None)
    gone = [e for e in mine if e["effective_status"] in ("superseded", "abandoned", "evolved")]
    lines = [HEADER, f"# {label}", ""]
    lines += ["## Current direction", direction["summary"] or direction["title"] if direction else
              "No decision recorded yet.", ""]
    lines += _section("Active decisions", decisions, "None recorded.")
    lines += _section("Active hypotheses", [e for e in live if e["type"] == "hypothesis"])
    lines += _section("Experiments", [e for e in live if e["type"] == "experiment"])
    lines += _section("Latest findings", [e for e in live if e["type"] == "finding"][-6:])
    lines += _section("Open questions", [e for e in mine if e["type"] == "question"
                                         and e["effective_status"] == "open"], "None recorded.")
    lines += _section("Ideas", [e for e in live if e["type"] == "idea"])
    if gone:
        lines += ["## Superseded and set aside"]
        for e in gone:
            by = view.get(e.get("changed_by", ""), {})
            lines.append(f"- {e['title']} — {e['effective_status']} by `{e.get('changed_by')}`"
                         + (f": {by.get('reason') or by.get('title')}" if by else ""))
        lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def cross_project(events: list[dict]) -> Counter:
    pairs = Counter()
    for e in events:
        ps = sorted(set(e.get("projects") or []) - {store.PORTFOLIO})
        pairs.update(combinations(ps, 2))
    return pairs


def portfolio_state(view: dict[str, dict], labels: dict[str, str]) -> str:
    events = sorted(view.values(), key=when)
    per_project = Counter(p for e in events for p in e.get("projects") or [])
    tag_projects = defaultdict(set)
    for e in events:
        for t in e.get("tags") or []:
            tag_projects[t].update(e.get("projects") or [])
    major = [e for e in events if e["type"] == "decision" and e.get("importance") == "major"
             and e["effective_status"] == "active"]
    lines = [HEADER, "# Portfolio", ""]
    portfolio_major = [e for e in major if store.PORTFOLIO in (e.get("projects") or [])]
    lines += ["## Current portfolio direction",
              (portfolio_major[-1]["summary"] or portfolio_major[-1]["title"]) if portfolio_major
              else "No portfolio-wide decision recorded yet.", ""]
    lines += ["## Projects with recorded lineage",
              *([f"- {labels.get(p, p)}: {n} event{'s' * (n != 1)}" for p, n in per_project.most_common()] or ["None yet."]), ""]
    shared = sorted((t for t, ps in tag_projects.items() if len(ps) > 1), key=lambda t: -len(tag_projects[t]))
    lines += ["## Shared themes", *([f"- {t} ({', '.join(sorted(labels.get(p, p) for p in tag_projects[t]))})"
                                     for t in shared] or ["None yet."]), ""]
    lines += _section("Recent major decisions", major[-8:], "None recorded.")
    lines += ["## Cross-project connections",
              *([f"- {labels.get(a, a)} ↔ {labels.get(b, b)} ({n})" for (a, b), n in
                 cross_project(events).most_common(12)] or ["None yet."]), ""]
    cross_q = [e for e in events if e["type"] == "question" and e["effective_status"] == "open"
               and len(set(e.get("projects") or [])) > 1]
    lines += _section("Open cross-project questions", cross_q, "None recorded.")
    return "\n".join(lines).rstrip() + "\n"


def context(view: dict[str, dict]) -> dict:
    """The compact state an agent reads before substantial work. Titles and ids only."""
    out: dict[str, dict] = {}
    for e in sorted(view.values(), key=when):
        for p in e.get("projects") or [store.PORTFOLIO]:
            slot = out.setdefault(p, {"active_decisions": [], "hypotheses": [], "open_questions": [],
                                      "recent_findings": []})
            item = {"id": e["id"], "title": e["title"]}
            if e["type"] == "decision" and e["effective_status"] == "active":
                slot["active_decisions"].append(item)
            elif e["type"] == "hypothesis" and e["effective_status"] == "active":
                slot["hypotheses"].append(item)
            elif e["type"] == "question" and e["effective_status"] == "open":
                slot["open_questions"].append(item)
            elif e["type"] == "finding" and e["effective_status"] != "superseded":
                slot["recent_findings"] = (slot["recent_findings"] + [item])[-5:]
    return {"generated_at": store.now(), "projects": out}


DIARY_SECTIONS = [("Major decisions", lambda e: e["type"] == "decision" and e.get("importance") == "major"),
                  ("Decisions", lambda e: e["type"] == "decision" and e.get("importance") != "major"),
                  ("New ideas", lambda e: e["type"] == "idea"),
                  ("Hypotheses", lambda e: e["type"] == "hypothesis"),
                  ("Experiments", lambda e: e["type"] == "experiment"),
                  ("Findings", lambda e: e["type"] == "finding"),
                  ("Implemented", lambda e: e["type"] == "implementation"),
                  ("Set aside", lambda e: e["type"] == "rejection"),
                  ("Observations", lambda e: e["type"] == "observation"),
                  ("Open questions", lambda e: e["type"] == "question")]


def page(title: str, events: list[dict], labels: dict[str, str]) -> str:
    lines = [HEADER, f"# {title}", ""]
    for heading, test in DIARY_SECTIONS:
        items = [e for e in events if test(e)]
        if items:
            lines += [f"## {heading}"]
            for e in items:
                ps = ", ".join(labels.get(p, p) for p in e.get("projects") or [])
                lines.append(f"- **{e['title']}**" + (f" · {ps}" if ps else "")
                             + (f" *({e['certainty']})*" if e.get("certainty") not in (None, "confirmed") else ""))
                if e.get("summary"):
                    lines.append(f"  {e['summary']}")
            lines.append("")
    pairs = cross_project(events)
    if pairs:
        lines += ["## New connections", *[f"- {labels.get(a, a)} ↔ {labels.get(b, b)}" for a, b in pairs], ""]
    return "\n".join(lines).rstrip() + "\n"


def clear(folder: Path) -> None:
    """Generated views are rebuilt whole, so a page whose events moved does not linger."""
    for old in folder.glob("*.md") if folder.is_dir() else []:
        old.unlink()


def write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def build_state() -> list[Path]:
    events = store.read_events()
    view = effective(events)
    labels = project_names()
    folder = store.home() / "state"
    clear(folder)
    out = []
    for pid in sorted({p for e in events for p in e.get("projects") or []}):
        out.append(folder / f"{pid}.md")
        write(out[-1], project_state(pid, view, labels.get(pid, pid)))
    out.append(folder / "portfolio.md")
    write(out[-1], portfolio_state(view, labels))
    out.append(store.home() / "context.json")
    write(out[-1], json.dumps(context(view), ensure_ascii=False, indent=1) + "\n")
    return out


def build_diary() -> list[Path]:
    events = store.read_events()
    labels = project_names()
    by_day = defaultdict(list)
    for e in events:
        by_day[when(e)].append(e)
    clear(store.home() / "diary")
    out = []
    for day, items in sorted(by_day.items()):
        out.append(store.home() / "diary" / f"{day}.md")
        write(out[-1], page(long_date(day), items, labels))
    return out


def build_digest() -> list[Path]:
    events = store.read_events()
    labels = project_names()
    by_week = defaultdict(list)
    for e in events:
        y, w, _ = date.fromisoformat(when(e)).isocalendar()
        by_week[f"{y}-W{w:02d}"].append(e)
    clear(store.home() / "digests")
    out = []
    for week, items in sorted(by_week.items()):
        out.append(store.home() / "digests" / f"{week}.md")
        write(out[-1], page(f"Week {week}", items, labels))
    return out


def public_events(events: list[dict]) -> list[dict]:
    """Only events marked public, only publishable fields, only links between public events."""
    public = [e for e in events if e.get("visibility") == "public"]
    ids = {e["id"] for e in public}
    out = []
    for e in public:
        row = {k: e[k] for k in PUBLIC_FIELDS if e.get(k) not in (None, [], {})}
        rels = {r: [t for t in ts if t in ids] for r, ts in (e.get("relations") or {}).items()}
        row["relations"] = {r: ts for r, ts in rels.items() if ts}
        if not row["relations"]:
            del row["relations"]
        out.append(row)
    return out


def build_export() -> list[Path]:
    write(EXPORT, json.dumps({"generated_at": store.now(), "events": public_events(store.read_events())},
                             ensure_ascii=False, separators=(",", ":")) + "\n")
    return [EXPORT]


def build_duckdb() -> list[Path]:
    """Optional analytics tables, rebuilt from the journal (local only, never published)."""
    try:
        import duckdb
    except ImportError:
        return []
    events = store.read_events()
    path = store.home() / "idea_lineage.duckdb"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.unlink(missing_ok=True)
    con = duckdb.connect(str(path))
    con.execute("create table dim_event (id text, created_at text, occurred_on text, type text, title text, "
                "summary text, importance text, status text, certainty text, visibility text)")
    con.executemany("insert into dim_event values (?,?,?,?,?,?,?,?,?,?)", [
        [e["id"], e["created_at"], e.get("occurred_on"), e["type"], e["title"], e.get("summary"),
         e.get("importance"), effective(events)[e["id"]]["effective_status"], e.get("certainty"),
         e.get("visibility", "private")] for e in events])
    con.execute("create table bridge_event_project (event_id text, project_id text)")
    con.executemany("insert into bridge_event_project values (?,?)",
                    [[e["id"], p] for e in events for p in e.get("projects") or []] or [["", ""]])
    con.execute("create table bridge_event_tag (event_id text, tag text)")
    con.executemany("insert into bridge_event_tag values (?,?)",
                    [[e["id"], t] for e in events for t in e.get("tags") or []] or [["", ""]])
    con.execute("create table fact_relation (source_id text, relation text, target_id text, confidence text)")
    con.executemany("insert into fact_relation values (?,?,?,?)", [list(l) for l in links(events)] or [["", "", "", ""]])
    for table in ["bridge_event_project", "bridge_event_tag", "fact_relation"]:
        con.execute(f"delete from {table} where {'event_id' if 'bridge' in table else 'source_id'} = ''")
    con.execute("create table dim_project as select distinct project_id from bridge_event_project")
    con.execute("create table dim_tag as select distinct tag from bridge_event_tag")
    con.close()
    return [path]


def main(argv: list[str]) -> int:
    what = argv[0] if argv else "all"
    steps = {"state": [build_state], "diary": [build_diary], "digest": [build_digest],
             "export": [build_export], "duckdb": [build_duckdb],
             "all": [build_state, build_diary, build_digest, build_export, build_duckdb]}[what]
    for step in steps:
        paths = step()
        print(f"{step.__name__.removeprefix('build_')}: {len(paths)} files")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
