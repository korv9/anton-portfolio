"""Find symbol words in a text and cut out the sentences around them.

Deterministic and dependency-free, so the same text always gives the same occurrences:

- Sentences are split with a regular expression: a sentence ends at '.', '!' or '?' (with any
  closing quotes or brackets) followed by white space, or at the end of the text. Abbreviations
  will sometimes split a sentence early; for a context window that is acceptable.
- An alias matches as a whole word, case-insensitively ("Serpent" and "serpent", not
  "serpentine"). Aliases are listed with their plural forms; nothing is stemmed.
- Where two aliases cover the same characters, the longer match wins, so a word is counted once.
- The context is the previous sentence, the sentence with the match and the next one. Verse
  can run a "sentence" for a page, so each sentence is cut to a window around the match
  (MAX_SENTENCE characters) and its neighbours to MAX_NEIGHBOUR, at word boundaries.
- An occurrence id is a hash of the document, the character offset and the symbol: the same
  text and vocabulary give the same ids on every run.
"""
from __future__ import annotations

import hashlib
import re
from bisect import bisect_right
from dataclasses import dataclass

SENTENCE_END = re.compile(r"""[.!?]+["'’”)\]]*(?=\s|$)""")
MAX_SENTENCE = 420
MAX_NEIGHBOUR = 260


@dataclass(frozen=True)
class Occurrence:
    occurrence_id: str
    document_id: str
    symbol_id: str
    matched_term: str
    sentence: str
    previous_sentence: str
    next_sentence: str
    context: str
    char_start: int
    char_end: int


def sentence_spans(text: str) -> list[tuple[int, int]]:
    """(start, end) of each sentence, covering the text without its surrounding white space."""
    spans, start = [], 0
    for end_match in SENTENCE_END.finditer(text):
        end = end_match.end()
        if text[start:end].strip():
            spans.append(_strip(text, start, end))
        start = end
    if text[start:].strip():
        spans.append(_strip(text, start, len(text)))
    return spans


def _strip(text: str, start: int, end: int) -> tuple[int, int]:
    while start < end and text[start].isspace():
        start += 1
    while end > start and text[end - 1].isspace():
        end -= 1
    return start, end


def alias_pattern(aliases: list[str]) -> re.Pattern:
    """One pattern for all aliases, longest first, each as a whole word."""
    ordered = sorted(set(a.lower() for a in aliases), key=lambda a: (-len(a), a))
    return re.compile(r"\b(" + "|".join(re.escape(a) for a in ordered) + r")\b", re.IGNORECASE)


def find_matches(text: str, aliases: dict[str, str]) -> list[tuple[int, int, str, str]]:
    """(start, end, symbol_id, matched text) for every alias in the text, no two overlapping."""
    if not aliases:
        return []
    found = [(m.start(), m.end(), aliases[m.group(1).lower()], m.group(1))
             for m in alias_pattern(list(aliases)).finditer(text)]
    found.sort(key=lambda m: (m[0], -(m[1] - m[0])))
    kept, last_end = [], -1
    for match in found:
        if match[0] >= last_end:
            kept.append(match)
            last_end = match[1]
    return kept


def _window(text: str, start: int, end: int, focus: tuple[int, int] | None, limit: int) -> str:
    """The text from start to end, cut to `limit` characters around `focus` at word boundaries."""
    if end - start <= limit:
        return text[start:end]
    if focus is None:
        cut = text[start:start + limit]
        return cut[: cut.rfind(" ")].rstrip() + " …" if " " in cut else cut
    centre = (focus[0] + focus[1]) // 2
    lo = max(start, min(centre - limit // 2, end - limit))
    hi = min(end, lo + limit)
    piece = text[lo:hi]
    if lo > start and " " in piece:
        piece = "… " + piece[piece.find(" ") + 1:]
    if hi < end and " " in piece:
        piece = piece[: piece.rfind(" ")] + " …"
    return piece


def occurrence_id(document_id: str, char_start: int, symbol_id: str) -> str:
    return hashlib.sha1(f"{document_id}:{char_start}:{symbol_id}".encode()).hexdigest()[:16]


def extract(document_id: str, text: str, aliases: dict[str, str]) -> list[Occurrence]:
    """Every symbol occurrence in one document with its three-sentence context.

    `aliases` maps a lower-case alias to its symbol id. Sentences never cross into another
    document: each call sees one text.
    """
    spans = sentence_spans(text)
    starts = [s for s, _ in spans]
    out = []
    for start, end, symbol, term in find_matches(text, aliases):
        i = max(0, bisect_right(starts, start) - 1)
        s_start, s_end = spans[i]
        sentence = _window(text, s_start, s_end, (start, end), MAX_SENTENCE)
        previous = _window(text, *spans[i - 1], None, MAX_NEIGHBOUR) if i > 0 else ""
        following = _window(text, *spans[i + 1], None, MAX_NEIGHBOUR) if i + 1 < len(spans) else ""
        context = " ".join(part for part in (previous, sentence, following) if part)
        out.append(Occurrence(occurrence_id(document_id, start, symbol), document_id, symbol, term,
                              sentence, previous, following, context, start, end))
    return out
