"""Cut a cleaned philosophical text into passages: the unit the Philosophy Atlas maps.

A passage is one or more consecutive paragraphs of the cleaned body (nlp/symbolic/cleaning.py,
which removes Gutenberg's header and licence, tables of contents, indexes, notes and footnotes):
short paragraphs are joined until a passage has at least MIN_WORDS words, and a paragraph longer
than MAX_WORDS is split at sentence ends. Headings (short lines, or lines mostly in capitals) and
lines that are only numbers are dropped. Text is otherwise verbatim.
"""
from __future__ import annotations

import re

MIN_WORDS = 60
MAX_WORDS = 220
SENTENCE = re.compile(r"(?<=[.!?;])\s+(?=[A-Z“\"'(])")


def is_heading(paragraph: str) -> bool:
    words = paragraph.split()
    if len(words) <= 8 and not paragraph.rstrip().endswith((".", "?", "!", ";", ":")):
        return True
    letters = [c for c in paragraph if c.isalpha()]
    return bool(letters) and sum(c.isupper() for c in letters) / len(letters) > 0.6


def paragraphs(text: str) -> list[str]:
    out = []
    for block in re.split(r"\n\s*\n", text):
        p = " ".join(block.split())
        if not p or re.fullmatch(r"[\divxlcIVXLC.\s§-]+", p) or is_heading(p):
            continue
        out.append(p)
    return out


def split_long(paragraph: str) -> list[str]:
    words = paragraph.split()
    if len(words) <= MAX_WORDS:
        return [paragraph]
    parts, current = [], []
    for sentence in SENTENCE.split(paragraph):
        if current and len(" ".join(current + [sentence]).split()) > MAX_WORDS:
            parts.append(" ".join(current))
            current = []
        current.append(sentence)
    if current:
        parts.append(" ".join(current))
    return parts


def passages(text: str) -> list[str]:
    out: list[str] = []
    buffer: list[str] = []
    for p in paragraphs(text):
        for piece in split_long(p):
            buffer.append(piece)
            if len(" ".join(buffer).split()) >= MIN_WORDS:
                out.append(" ".join(buffer))
                buffer = []
    if buffer:
        tail = " ".join(buffer)
        if out and len(tail.split()) < MIN_WORDS // 2:
            out[-1] = f"{out[-1]} {tail}"
        else:
            out.append(tail)
    return out


def find_line(lines: list[str], marker: dict, after: int = 0) -> int:
    """Index of the `occurrence`-th line (1-based) at or after `after` whose stripped text matches
    `marker['line']` in full."""
    pattern = re.compile(marker["line"])
    seen = 0
    for i in range(after, len(lines)):
        if pattern.fullmatch(lines[i].strip()):
            seen += 1
            if seen == (marker.get("occurrence") or 1):
                return i
    raise ValueError(f"marker {marker} not found")


def own_text(raw: str, start: dict | None, end: dict | None) -> tuple[str, int, int]:
    """The author's own text: from the start marker (inclusive) to the end marker (exclusive).

    Editions carry a translator's or editor's introduction, biographies, analyses and notes; the
    markers in corpus.json say where the work itself begins and ends, so that writing by others
    is not mapped as the philosopher's. The result keeps Gutenberg's START/END lines so the shared
    cleaning still finds the boundaries. Returns the text and the line range kept.
    """
    lines = raw.replace("\r\n", "\n").split("\n")
    head = next(i for i, line in enumerate(lines) if "*** START OF" in line)
    tail = next((i for i, line in enumerate(lines) if "*** END OF" in line), len(lines))
    first = find_line(lines, start, head + 1) if start else head + 1
    last = find_line(lines, end, first + 1) if end else tail
    body = lines[first:min(last, tail)]
    return "\n".join([lines[head], *body, lines[tail] if tail < len(lines) else ""]), first, last
