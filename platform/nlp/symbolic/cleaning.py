"""Clean a Gutenberg book down to its narrative text, and record what was removed.

The silver documents used to be cleaned in SQL: Gutenberg's header and licence cut off, white
space collapsed. That let paratext through (tables of contents, glossaries, indexes, notes,
bibliographies, footnotes), and some cross-book clusters turned out to be made of it: the
glossary of one book and the index of another look alike to an embedding whatever their
words. This module removes that structure while the line breaks still show it, and only then
collapses white space.

The rules are deliberately few, explicit and conservative; each is its own function:

1. strip_gutenberg_boilerplate: keep the text between the START and END markers, and drop a
   "Produced by …" credit paragraph at the very top.
2. remove_footnote_blocks: bracketed "[Footnote 12: …]" and "[Transcriber's note: …]" blocks
   (they can sit anywhere, so they are matched by their brackets, not by a heading).
3. Sections under a stand-alone heading, the heading being a short line on its own with at
   least two blank lines before it (how Gutenberg books set section headings):
   - remove_table_of_contents: CONTENTS / TABLE OF CONTENTS / LIST OF ILLUSTRATIONS, and the
     short list-like paragraphs after it, up to the first paragraph that reads as prose.
   - remove_glossary_sections / remove_index_sections: GLOSSARY, VOCABULARY, INDEX, … to the
     next heading, but only when the section looks like a glossary or index (most entries are
     short "Term, …" / "Term. …" lines, or carry page numbers).
   - remove_editorial_notes: BIBLIOGRAPHY and REFERENCES wherever they stand; NOTES, NOTES AND
     REFERENCES, FOOTNOTES, ENDNOTES, APPENDIX, DRAMATIS PERSONAE … in the last quarter of a
     book, or earlier only when their entries look like notes (numbered "[1] …" entries or
     bibliography lines), so a chapter that happens to be called "Notes" in the middle of a
     story stays.
   A section runs to the next heading in capitals that is not itself an entry ("[1] …"), or
   to the end of the book. A table of contents ends at its first paragraph that is not a list.
   The words alone never trigger anything: "index", "notes" or "contents" in a sentence are
   prose. Only a stand-alone heading line does.
4. Collapse white space to single spaces, as before, so the occurrence extraction (context.py)
   sees the same kind of text. Character offsets are offsets in this cleaned text; occurrence
   ids stay deterministic for a given cleaning version.

Every removal is recorded (kind, heading, line range, characters) so the cleaning can be
audited, and clean_document refuses (CleaningError) when more than MAX_REMOVED_SHARE of a book
would go or fewer than MIN_CLEAN_WORDS words would remain: that means a rule misfired.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

CLEANING_VERSION = "2"
MAX_REMOVED_SHARE = 0.5
WARN_REMOVED_SHARE = 0.3
MIN_CLEAN_WORDS = 5000

START = re.compile(r"\*\*\*\s*START OF (?:THE|THIS) PROJECT GUTENBERG E(?:BOOK|TEXT)[^*]*\*\*\*")
END = re.compile(r"\*\*\*\s*END OF (?:THE|THIS) PROJECT GUTENBERG")
CREDIT = re.compile(r"^\s*(?:produced by|e-?text prepared by|transcribed by)\b", re.IGNORECASE)
FOOTNOTE_BLOCK = re.compile(r"\[(?:Footnote|Transcriber'?s? ?[Nn]ote|Note)\b[^\]]*\]", re.IGNORECASE)
ILLUSTRATION = re.compile(r"\[Illustration[^\]]*\]", re.IGNORECASE)

CONTENTS = re.compile(r"^(?:table of )?contents|^list of (?:illustrations|plates)", re.IGNORECASE)
GLOSSARY = re.compile(r"^(?:glossary|vocabulary|pronouncing (?:vocabulary|glossary|index)"
                      r"|glossary and index)\b", re.IGNORECASE)
INDEX = re.compile(r"^(?:general )?index(?: of (?:names|persons|places|proper names))?$", re.IGNORECASE)
EDITORIAL = re.compile(r"^(?:notes(?: and references)?|footnotes|endnotes|appendix(?: [ivx\d]+)?"
                       r"|dramatis person(?:ae|æ)|persons of the (?:dialogue|drama)|cast of characters)$",
                       re.IGNORECASE)
# Never narrative wherever they stand.
REFERENCE_LIST = re.compile(r"^(?:bibliography|references|works cited|list of authorities)$", re.IGNORECASE)
HEADING_MAX = 60


class CleaningError(ValueError):
    """A rule removed far more than paratext can account for."""


@dataclass
class Removal:
    kind: str
    heading: str
    start_line: int
    end_line: int
    chars: int


@dataclass
class Cleaned:
    """The cleaned text and its audit. Character counts are of white-space-collapsed text:
    raw is the whole file, body is what the old cleaning kept (no Gutenberg header or licence),
    clean is the narrative text. removed_* is body minus clean: what the paratext rules took."""
    text: str
    raw_char_count: int
    body_char_count: int
    clean_char_count: int
    removals: list[Removal] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    @property
    def removed_char_count(self) -> int:
        return self.body_char_count - self.clean_char_count

    @property
    def removed_share(self) -> float:
        return round(self.removed_char_count / self.body_char_count, 4) if self.body_char_count else 0.0

    @property
    def sections_removed(self) -> list[str]:
        return [f"{r.kind}:{r.heading}" for r in self.removals if r.kind != "footnote"]


# ---------------------------------------------------------------------------- boilerplate


def strip_gutenberg_boilerplate(text: str) -> str:
    """The text between Gutenberg's START and END markers (all of it when they are missing),
    without a leading "Produced by …" credit paragraph."""
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    start = START.search(text)
    if start:
        text = text[start.end():]
    end = END.search(text)
    if end:
        text = text[: end.start()]
    paragraphs = text.lstrip("\n").split("\n\n")
    if paragraphs and CREDIT.match(paragraphs[0]):
        paragraphs = paragraphs[1:]
    return "\n\n".join(paragraphs)


def remove_footnote_blocks(text: str) -> tuple[str, list[Removal]]:
    """Bracketed footnote and transcriber's-note blocks, which may span lines."""
    removals = []

    def drop(m: re.Match) -> str:
        line = text.count("\n", 0, m.start())
        removals.append(Removal("footnote", m.group(0)[:40], line, line + m.group(0).count("\n"),
                                len(m.group(0))))
        return " "

    return FOOTNOTE_BLOCK.sub(drop, text), removals


# ---------------------------------------------------------------------------- sections


def is_heading(lines: list[str], i: int) -> bool:
    """A short stand-alone line with at least two blank lines before it and one after."""
    line = lines[i].strip()
    if not line or len(line) > HEADING_MAX or line.endswith(","):
        return False
    before = lines[max(0, i - 2): i]
    after_blank = i + 1 >= len(lines) or not lines[i + 1].strip()
    return (i < 2 or all(not b.strip() for b in before)) and after_blank


def heading_text(line: str) -> str:
    return re.sub(r"[\s.:]+$", "", line.strip())


def headings(lines: list[str]) -> list[int]:
    return [i for i in range(len(lines)) if is_heading(lines, i)]


def paragraphs(lines: list[str], start: int, end: int) -> list[tuple[int, int, str]]:
    """(first line, last line, text) of each blank-line-separated paragraph in lines[start:end]."""
    out, first = [], None
    for i in range(start, end):
        if lines[i].strip():
            if first is None:
                first = i
        elif first is not None:
            out.append((first, i - 1, "\n".join(lines[first:i])))
            first = None
    if first is not None:
        out.append((first, end - 1, "\n".join(lines[first:end])))
    return out


ENTRY_LINE = re.compile(
    r"^\s*(?:[IVXLC]+\.|\d+\.|(?:chapter|book|part|rune|canto|story|song|hymn|tale|fitt?)\b)",
    re.IGNORECASE)


def is_entry_line(line: str) -> bool:
    """A line as tables of contents have them: short, and in capitals, numbered (Roman or
    Arabic), opening with CHAPTER, BOOK, RUNE and the like, or ending with a page number."""
    text = line.strip()
    if not text or len(text) > 80:
        return False
    letters = [c for c in text if c.isalpha()]
    caps = bool(letters) and sum(c.isupper() for c in letters) / len(letters) >= 0.8
    # An indented title without closing punctuation ("     The Snow Queen").
    indented_title = line.startswith("  ") and not re.search(r"[,;:!?]$|[a-z]\.$", text)
    return caps or indented_title or bool(ENTRY_LINE.match(text)) \
        or bool(re.search(r"(?:\d{1,4}|\b[ivxlc]+)\s*$", text)) or text.startswith("--")


def is_list_like(paragraph: str) -> bool:
    lines = [l for l in paragraph.split("\n") if l.strip()]
    return bool(lines) and sum(is_entry_line(l) for l in lines) / len(lines) >= 0.6


def is_section_heading(line: str) -> bool:
    """A heading that starts a new part of the book: mostly capitals, not a numbered entry."""
    text = line.strip()
    letters = [c for c in text if c.isalpha()]
    return (len(letters) >= 3 and not re.match(r"^[\[\d(]", text)
            and sum(c.isupper() for c in letters) / len(letters) >= 0.7)


ENTRY = re.compile(r"^[\"'‘“(]?[A-ZÆØÅÄÖÜ][\w’'\-À-ÿ]*(?:[ \-][\w’'À-ÿ]+){0,3}[’'\"]?\s*[,.(:—–-]")
PAGE_REF = re.compile(r"\b\d{1,4}(?:[-–]\d{1,4})?(?:,\s*\d{1,4})+\b|\b\d{1,4}\s*$")


def entries(lines: list[str], start: int, end: int) -> list[str]:
    """The entries of a list-like section: its paragraphs, or its lines when the paragraphs are
    long blocks of one-line entries (as in the Kalevala's glossary)."""
    paras = [p[2] for p in paragraphs(lines, start, end)]
    if paras and max(len(p.split("\n")) for p in paras) > 8:
        return [l.strip() for l in lines[start:end] if l.strip()]
    return paras


def looks_like_glossary(items: list[str]) -> bool:
    """Most entries are short and open with a term and a comma, full stop or bracket."""
    if len(items) < 8:
        return False
    short = [e for e in items if len(" ".join(e.split())) <= 400]
    termed = [e for e in short if ENTRY.match(e.strip())]
    return len(termed) / len(items) >= 0.6


def looks_like_index(items: list[str]) -> bool:
    if len(items) < 8:
        return False
    return sum(bool(PAGE_REF.search(e)) for e in items) / len(items) >= 0.5 or looks_like_glossary(items)


def looks_like_notes(items: list[str]) -> bool:
    """Numbered notes ("[1] …", "1. …") or bibliography-like lines make up a third or more."""
    if not items:
        return False
    numbered = sum(bool(re.match(r"^\s*(?:\[\d+\]|\d+[.)]\s|[A-Z][A-Z]+\.?—)", e)) for e in items)
    return numbered / len(items) >= 0.33


def _section_end(lines: list[str], heads: list[int], at: int) -> int:
    """The next heading that starts a new part of the book (not another entry), or the end."""
    later = [h for h in heads if h > at and is_section_heading(lines[h])]
    return later[0] if later else len(lines)


def find_sections(lines: list[str]) -> list[Removal]:
    """Every paratext section in the lines, by the rules in the module docstring."""
    heads = headings(lines)
    total = len(lines)
    found: list[Removal] = []
    for h in heads:
        title = heading_text(lines[h])
        end = _section_end(lines, heads, h)
        if CONTENTS.match(title):
            found.append(_contents(lines, h, title))
        elif GLOSSARY.match(title):
            if looks_like_glossary(entries(lines, h + 1, end)) or looks_like_index(entries(lines, h + 1, end)):
                # A glossary runs to the end of the book when nothing but more entries follows.
                found.append(Removal("glossary", title, h, end - 1, 0))
        elif INDEX.match(title):
            if looks_like_index(entries(lines, h + 1, end)):
                found.append(Removal("index", title, h, end - 1, 0))
        elif REFERENCE_LIST.match(title):
            found.append(Removal("editorial", title, h, end - 1, 0))
        elif EDITORIAL.match(title):
            items = entries(lines, h + 1, end)
            late = h >= total * 0.75
            if late or looks_like_notes(items):
                found.append(Removal("editorial", title, h, end - 1, 0))
    return found


def _contents(lines: list[str], h: int, title: str) -> Removal:
    """A table of contents: the heading and the list-like paragraphs after it, up to the first
    paragraph that is not a list (prose, verse), at most 400 lines."""
    last = h
    for first, end, text in paragraphs(lines, h + 1, min(len(lines), h + 400)):
        # A one-line paragraph that is not an entry ("Page", a part title) does not end the list.
        if not is_list_like(text) and (end > first or len(text.strip()) > 60):
            break
        last = end
    return Removal("contents", title, h, last, 0)


def remove_sections(text: str, kinds: set[str] | None = None) -> tuple[str, list[Removal]]:
    """Remove the paratext sections (optionally only some kinds), keeping every other line in
    order. Returns the text and what was removed, with character counts."""
    lines = text.split("\n")
    sections = [s for s in find_sections(lines) if kinds is None or s.kind in kinds]
    drop = [False] * len(lines)
    for s in sections:
        s.chars = sum(len(lines[i]) + 1 for i in range(s.start_line, s.end_line + 1) if not drop[i])
        for i in range(s.start_line, s.end_line + 1):
            drop[i] = True
    return "\n".join(l for l, d in zip(lines, drop) if not d), sections


def remove_table_of_contents(text: str) -> tuple[str, list[Removal]]:
    return remove_sections(text, {"contents"})


def remove_glossary_sections(text: str) -> tuple[str, list[Removal]]:
    return remove_sections(text, {"glossary"})


def remove_index_sections(text: str) -> tuple[str, list[Removal]]:
    return remove_sections(text, {"index"})


def remove_editorial_notes(text: str) -> tuple[str, list[Removal]]:
    return remove_sections(text, {"editorial"})


# ---------------------------------------------------------------------------- the document


def collapse(text: str) -> str:
    return re.sub(r"\s+", " ", ILLUSTRATION.sub(" ", text)).strip()


def clean_document(text: str, metadata: dict | None = None, check: bool = True) -> Cleaned:
    """The narrative text of one book and the record of what was removed.

    `metadata` (document_id, title) only labels warnings and errors. With `check`, a book that
    would lose more than MAX_REMOVED_SHARE of its characters, or keep fewer than
    MIN_CLEAN_WORDS words, raises CleaningError instead of being silently gutted.
    """
    name = (metadata or {}).get("document_id", "document")
    raw = text.replace("\r\n", "\n")
    body = strip_gutenberg_boilerplate(raw)
    body, notes = remove_footnote_blocks(body)
    body, sections = remove_sections(body)
    clean = collapse(body)
    baseline = collapse(strip_gutenberg_boilerplate(raw))
    result = Cleaned(clean, len(collapse(raw)), len(baseline), len(clean), notes + sections)
    share = result.removed_share
    words = len(clean.split())
    if share > WARN_REMOVED_SHARE:
        result.warnings.append(f"{name}: {share:.0%} of the text removed")
    if words < MIN_CLEAN_WORDS:
        result.warnings.append(f"{name}: only {words} words remain")
    if check and (share > MAX_REMOVED_SHARE or words < MIN_CLEAN_WORDS):
        raise CleaningError("; ".join(result.warnings))
    return result
