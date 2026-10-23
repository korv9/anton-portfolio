"""One skill vocabulary for CVs and job ads: the job-requirements taxonomy plus a few CV terms.

Evidence levels, strongest first:
- practical: named in a line of an employment or internship (LIA) entry;
- education_or_project: named in an education entry or an own or thesis project;
- listed: named only in the CV's skills list or summary, with no line that says where it was used;
- interest: an owner wish without documented experience (never read from the CV).
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from publish.job_content import SKILLS as REQUIREMENT_SKILLS  # noqa: E402

SKILLS = {
    **REQUIREMENT_SKILLS,
    # The requirement pattern also reads "Spring 2026" as the framework.
    "Spring": ("framework", r"\bspring\b(?!\s+\d{4})"),
    "Spark SQL": ("language", r"\bspark sql\b"),
    "pandas": ("framework", r"\bpandas\b"),
    "pytest": ("practice", r"\bpytest\b"),
    "Playwright": ("practice", r"\bplaywright\b"),
    "Vite": ("framework", r"\bvite\b"),
    "Azure DevOps": ("practice", r"\bazure devops\b"),
    "incremental loads": ("practice", r"\bincremental(?: loads?)\b|inkrementell"),
    "machine learning": ("practice", r"\bmachine learning\b|maskininlärning"),
    "deep learning": ("practice", r"\bdeep learning\b|djupinlärning"),
    "OAI-PMH": ("practice", r"\boai-pmh\b"),
}
LEVELS = ("practical", "education_or_project", "listed", "interest")


def find_skills(text: str) -> list[tuple[str, str]]:
    """(skill, matched words) for every taxonomy skill the text names."""
    out = []
    for skill, (_, pattern) in SKILLS.items():
        m = re.search(pattern, text, re.I)
        if m:
            out.append((skill, m.group()))
    return out


def best_level(evidence: list[dict]) -> str:
    return min((e["level"] for e in evidence), key=LEVELS.index)
