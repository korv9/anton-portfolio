"""Shared text helpers for dictionary-based concept matching across corpora.

A concept is a named regular expression kept in a dbt seed (for the AI politics analysis,
seeds/ai_politics/ai_politics_concepts.csv), so the definitions are data, visible and testable,
not hidden in code. Matching is per paragraph: a long speech touches many subjects, and a
concept counts only where it appears in a paragraph that is itself about the subject (the gate).
Tested in platform/tests/ai_politics.
"""
from __future__ import annotations

import html
import re
from dataclasses import dataclass

TAG = re.compile(r"<[^>]+>")
PARAGRAPH_END = re.compile(r"</p\s*>|<br\s*/?>|\n\s*\n", re.I)


def paragraphs(markup: str) -> list[str]:
    """Plain-text paragraphs of an HTML fragment (Riksdagen's anforandetext), verbatim."""
    parts = PARAGRAPH_END.split(markup or "")
    out = []
    for part in parts:
        text = " ".join(html.unescape(TAG.sub(" ", part)).split())
        if text:
            out.append(text)
    return out


@dataclass(frozen=True)
class Concept:
    concept_id: str
    pattern: re.Pattern

    @classmethod
    def from_row(cls, concept_id: str, pattern: str, case_sensitive: bool) -> "Concept":
        return cls(concept_id, re.compile(pattern, 0 if case_sensitive else re.IGNORECASE))

    def terms(self, text: str) -> list[str]:
        """Every match in `text`, as written."""
        return [m.group(0) for m in self.pattern.finditer(text)]


def match_paragraphs(paras: list[str], gate: Concept, concepts: list[Concept]) -> list[dict]:
    """For each paragraph the gate matches: its index, text, gate terms and concept terms."""
    rows = []
    for i, text in enumerate(paras):
        gate_terms = gate.terms(text)
        if not gate_terms:
            continue
        rows.append({
            "paragraph": i,
            "text": text,
            "gate_terms": gate_terms,
            "concepts": {c.concept_id: t for c in concepts if (t := c.terms(text))},
        })
    return rows
