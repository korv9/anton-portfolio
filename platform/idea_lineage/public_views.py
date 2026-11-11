"""The committed views: DECISIONS.md and DATA_DECISIONS.md in the repository root, and one page
per project plus a diary under docs/idea-lineage/. They are built from public events only, so a
private event can never reach a committed file. Rebuilt whole by `npm run ideas:build`.

A decision has three steps that are recorded separately: decided (the decision event),
implemented (an implementation reference, or an implementation event that `implements` it) and
verified (a run reference on either). A decision can stop at any step.
"""
from __future__ import annotations

from collections import defaultdict
from pathlib import Path

import store
from views import HEADER, effective, links, long_date, page, project_names, project_state, when, write

ROOT = store.ROOT
DOCS = ROOT / "docs/idea-lineage"
DATA_TAGS = {"data", "data-quality", "validity", "lineage"}
IMPLEMENTED_KEYS = ("commit", "pr", "files", "route", "artifact")


def public_view(events: list[dict]) -> dict[str, dict]:
    """Effective status computed over all events, then restricted to the public ones."""
    view = effective(events)
    return {i: e for i, e in view.items() if e.get("visibility") == "public"}


def progress(e: dict, view: dict[str, dict]) -> tuple[list[str], list[str]]:
    """(implementation references, run references) on the decision and on events implementing it."""
    sources = [e] + [view[s] for s, rel, t, conf in links(list(view.values()))
                     if rel == "implements" and t == e["id"] and conf == "explicit" and s in view]
    impl, runs = [], []
    for s in sources:
        ref = s.get("implementation") or {}
        impl += [f"{k} {', '.join(v) if isinstance(v, list) else v}" for k, v in ref.items() if k in IMPLEMENTED_KEYS]
        if ref.get("run"):
            runs.append(str(ref["run"]))
    return impl, runs


def decision_lines(e: dict, view: dict[str, dict]) -> list[str]:
    who = " · by Anton" if (e.get("source") or {}).get("kind") == "user" else ""
    out = [f"- {when(e)} · {e['title']} (`{e['id']}`{who})"]
    if e.get("summary"):
        out.append(f"  {e['summary']}")
    if e.get("reason"):
        out.append(f"  Why: {e['reason']}")
    if len(e.get("projects") or []) > 1:
        labels = project_names()
        out.append("  Also: " + ", ".join(labels.get(p, p) for p in e["projects"][1:]))
    for rel in ("supersedes", "replaces"):
        for t in (e.get("relations") or {}).get(rel, []):
            out.append(f"  Replaces: `{t}` {view[t]['title'] if t in view else ''}".rstrip())
    impl, runs = progress(e, view)
    # Absence of a reference is not evidence that nothing was built, so only recorded steps show.
    steps = ["rejected" if e["type"] == "rejection" else "decided"]
    if impl:
        steps.append("implemented: " + ", ".join(dict.fromkeys(impl)))
    if runs:
        steps.append("verified: " + ", ".join(dict.fromkeys(runs)))
    out.append("  " + " → ".join(steps) + ("" if impl else " (implementation not recorded)"))
    return out


def decisions_page(title: str, intro: str, view: dict[str, dict], keep) -> str:
    labels = project_names()
    by_project: dict[str, list[dict]] = defaultdict(list)
    for e in sorted(view.values(), key=when):
        if e["type"] in ("decision", "rejection") and keep(e):
            # Listed once, under its first project; the others are named on the entry.
            by_project[(e.get("projects") or [store.PORTFOLIO])[0]].append(e)
    lines = [HEADER, f"# {title}", "", intro, "",
             "Each entry shows the steps on record: decided → implemented (a commit, PR or file "
             "reference) → verified (a run reference). A later decision that replaces one is "
             "linked, and the replaced one moves to *Set aside* with the reason.", ""]
    if not by_project:
        lines += ["No decisions recorded yet.", ""]
    for p in sorted(by_project, key=lambda p: (p == store.PORTFOLIO, labels.get(p, p))):
        items = by_project[p]
        live = [e for e in items if e["effective_status"] in ("active", "completed")]
        gone = [e for e in items if e not in live]
        lines += [f"## {labels.get(p, p)}", ""]
        for e in live:
            lines += decision_lines(e, view)
        if gone:
            lines += ["", "Set aside:"]
            for e in gone:
                by = view.get(e.get("changed_by", ""), {})
                lines.append(f"- {when(e)} · {e['title']} — {e['effective_status']} by `{e.get('changed_by')}`"
                             + (f": {by.get('reason') or by.get('title')}" if by else ""))
        lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def build_root() -> list[Path]:
    view = public_view(store.read_events())
    out = [ROOT / "DECISIONS.md", ROOT / "DATA_DECISIONS.md"]
    write(out[0], decisions_page(
        "Decisions",
        "What is decided across the portfolio, why, and how far each decision got. Built from the "
        "public Idea Lineage journal (`.idea-lineage/public/journal/`, see `docs/platform/idea-lineage.md`). "
        "Current project status and next steps are in `PROJECTS.md`.",
        view, lambda e: True))
    write(out[1], decisions_page(
        "Data decisions",
        "Decisions about data: sources and their terms, selection and units, cleaning and missing "
        "values, keys, storage and publication, and model versions where they change how the data "
        "reads. The same events as in `DECISIONS.md`, kept to the ones tagged with data.",
        view, lambda e: DATA_TAGS & set(e.get("tags") or [])))
    return out


def build_docs() -> list[Path]:
    """docs/idea-lineage/: one page per project, the portfolio page and a diary, public only."""
    events = store.read_events()
    view = public_view(events)
    labels = project_names()
    public = sorted(view.values(), key=when)
    for old in [*DOCS.glob("*.md"), *(DOCS / "diary").glob("*.md")]:
        old.unlink()
    out = []
    projects = sorted({p for e in public for p in e.get("projects") or []})
    for pid in projects:
        out.append(DOCS / f"{pid}.md")
        write(out[-1], project_state(pid, view, labels.get(pid, pid)))
    by_day = defaultdict(list)
    for e in public:
        by_day[when(e)].append(e)
    for day, items in sorted(by_day.items()):
        out.append(DOCS / "diary" / f"{day}.md")
        write(out[-1], page(long_date(day), items, labels))
    index = [HEADER, "# Idea Lineage", "",
             "How the projects' ideas and decisions evolved, generated from the public journal. "
             "Decisions in force: `../../DECISIONS.md`. Status and next steps: `../../PROJECTS.md`.", "",
             "## Projects", *[f"- [{labels.get(p, p)}]({p}.md)" for p in projects], "",
             "## Diary", *[f"- [{long_date(d)}](diary/{d}.md)" for d in sorted(by_day, reverse=True)], ""]
    out.append(DOCS / "README.md")
    write(out[-1], "\n".join(index))
    return out
