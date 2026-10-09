"""Where the journal lives, how events are read, numbered and appended.

The journal is the source of truth: one JSON line per event in a file per day. Private events
go to `.idea-lineage/journal/` (git-ignored, since this repository is public); public events go
to `.idea-lineage/public/journal/`, which is committed. IDEA_LINEAGE_HOME moves the private
home elsewhere, for example into a private repository. Lines are only ever added.
"""
from __future__ import annotations

import json
import os
import re
from datetime import datetime
from pathlib import Path

from schema import ID_RE, validate

ROOT = Path(__file__).resolve().parents[2]
REGISTRY = ROOT / "frontend/src/projects/projectRegistry.ts"
# Portfolio-wide work (design, the site itself) has no registry entry; this is its one id.
PORTFOLIO = "portfolio"


def home() -> Path:
    return Path(os.environ.get("IDEA_LINEAGE_HOME", ROOT / ".idea-lineage"))


def public_home() -> Path:
    return Path(os.environ.get("IDEA_LINEAGE_PUBLIC", ROOT / ".idea-lineage/public"))


def journal_dirs() -> list[Path]:
    return [home() / "journal", public_home() / "journal"]


def now() -> str:
    return datetime.now().astimezone().isoformat(timespec="seconds")


def projects() -> dict[str, list[str]]:
    """Canonical project ids from the registry, each with the names that refer to it."""
    text = REGISTRY.read_text(encoding="utf-8")
    start = text.index("export const PROJECTS")
    # Only the PROJECTS list: later lists in the file (sidebar groups, platform pages) have ids too.
    end = text.find("\nexport const", start + 1)
    ids = re.findall(r"^    id: '([\w-]+)',", text[start:end if end > 0 else None], flags=re.M)
    names = {i: [i, i.replace("-", " ")] for i in ids}
    extra = {
        "ai-act": ["AI Act", "AI-förordningen", "EU AI Act"],
        "jobs": ["job market", "jobbannonser", "arbetsmarknaden", "job ads"],
        "symbolic-atlas": ["Symbolic Atlas", "Symbolic"],
        "concept-constellation": ["Concept Constellation", "Concept Journey", "concept layer"],
        "philosophy-atlas": ["Philosophy Atlas"],
        "politics": ["politics", "politik", "Riksdag", "riksdagen"],
        "welfare": ["welfare", "välfärd"],
        "thesis": ["thesis", "examensarbete"],
        "allegoria": ["Allegoria"],
    }
    for i, aliases in extra.items():
        if i in names:
            names[i] += aliases
    names[PORTFOLIO] = [PORTFOLIO, "Data Constellation", "data catalogue", "design system",
                        "homepage", "start page"]
    return names


def read_events() -> list[dict]:
    """Every event, private and public, in the order written."""
    events = []
    for folder in journal_dirs():
        for path in sorted(folder.glob("*.jsonl")) if folder.is_dir() else []:
            for n, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
                if line.strip():
                    try:
                        events.append(json.loads(line))
                    except json.JSONDecodeError as exc:
                        raise ValueError(f"{path}:{n}: {exc}") from exc
    return sorted(events, key=lambda e: e["created_at"])  # stable: journal order breaks ties


def next_id(kind: str, day: str, taken: set[str]) -> str:
    n = 1 + max((int(m.group(3)) for i in taken if (m := ID_RE.match(i))
                 and m.group(1) == kind and m.group(2) == day), default=0)
    return f"{kind}-{day}-{n:03d}"


def append(events: list[dict]) -> list[Path]:
    """Validate and append events; nothing is written unless every event passes."""
    existing = read_events()
    taken = {e["id"] for e in existing}
    known = set(taken)
    names = set(projects())
    problems = []
    for e in events:
        if e["id"] in known:
            problems.append(f"{e['id']}: id already used")
        known.add(e["id"])
    for e in events:
        problems += [f"{e['id']}: {p}" for p in validate(e, known, names)]
    if problems:
        raise ValueError("refused, nothing written:\n  " + "\n  ".join(problems))
    written = []
    for e in events:
        folder = public_home() if e.get("visibility") == "public" else home()
        path = folder / "journal" / f"{e['created_at'][:10]}.jsonl"
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(e, ensure_ascii=False, separators=(",", ":")) + "\n")
        written.append(path)
    return written
