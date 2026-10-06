"""Parse an EU act published as XHTML (Official Journal or consolidated text) into provisions.

    parse_act(xhtml) -> Act(chapters, provisions)

Both the Official Journal rendering (`oj-*` classes) and the consolidated rendering of the same
act (`norm`, `modref` classes) mark their structure with the same ELI ids: `cpt_III` for a
chapter, `cpt_III.sct_2` for a section, `art_6` for an article, `rct_12` for a recital and
`anx_III` for an annex, each with a `.tit_1` title. The parser follows those ids in document
order, so it does not depend on either rendering's styling.

A consolidated text marks every amended passage with a ▼ marker whose title names the amending
act and what it did (`32026R1744: REPLACED`); a marker holds until the next, and `▼B` returns to
the base act. The amending acts in force anywhere in a provision are collected per provision and
the markers left out of its text, so an article's text can be compared across versions.

Text is kept verbatim apart from white space: one line per block, list markers joined to their
item. Nothing is summarised or reworded here.
"""
from __future__ import annotations

import hashlib
import re
import unicodedata
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field

BLOCK = {"p", "div", "table", "tbody", "tr", "li", "ul", "ol", "h1", "h2", "h3", "h4", "hr"}
MARKER = re.compile(r"^(\(?[0-9]{1,3}[a-z]{0,2}\)|\(?[a-z]{1,3}\)|\(?[ivxl]{1,6}\)|[0-9]{1,3}[a-z]{0,2}\.|—|–|-)$")
CHAPTER = re.compile(r"^cpt_([IVXLC]+)$")
SECTION = re.compile(r"^cpt_([IVXLC]+)\.sct_(\d+)$")
ARTICLE = re.compile(r"^art_(\d+[a-z]*)$")
RECITAL = re.compile(r"^rct_(\d+[a-z]*)$")
ANNEX = re.compile(r"^anx_([IVXLC]+[a-z]*)$")
MODREF = re.compile(r"^(\w+(?:\(\d+\))?)(?::\s*([A-Z ]+))?$")

MONTHS = {m: i + 1 for i, m in enumerate(
    ["january", "february", "march", "april", "may", "june", "july", "august", "september",
     "october", "november", "december"])}


@dataclass
class Provision:
    provision_id: str          # art_6, rct_12, anx_III
    kind: str                  # article | recital | annex
    number: str                # 6, 12, III
    title: str = ""
    chapter: str | None = None
    chapter_title: str | None = None
    section: str | None = None
    section_title: str | None = None
    lines: list[str] = field(default_factory=list)
    amendments: list[dict] = field(default_factory=list)  # [{act, action}] from modref markers

    @property
    def text(self) -> str:
        return "\n".join(self.lines)

    @property
    def text_hash(self) -> str:
        return text_hash(self.text)


@dataclass
class Act:
    chapters: dict[str, str]
    sections: dict[str, str]
    provisions: list[Provision]

    def get(self, provision_id: str) -> Provision | None:
        return next((p for p in self.provisions if p.provision_id == provision_id), None)

    @property
    def articles(self) -> list[Provision]:
        return [p for p in self.provisions if p.kind == "article"]


def local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def classes(el: ET.Element) -> set[str]:
    return set((el.get("class") or "").split())


def normalise(text: str) -> str:
    """Unicode NFKC, one kind of space, no space before punctuation."""
    text = unicodedata.normalize("NFKC", text).replace(" ", " ")
    text = re.sub(r"[ \t\r\f\v]+", " ", text)
    return re.sub(r" ([,.;:)])", r"\1", text).strip()


def text_hash(text: str) -> str:
    """SHA-256 of a text with white space and quote styles folded, for comparing versions."""
    folded = normalise(text).replace("‘", "'").replace("’", "'").replace("“", '"').replace("”", '"')
    folded = re.sub(r"\s+", " ", folded).strip()
    return hashlib.sha256(folded.encode("utf-8")).hexdigest()


def block_lines(el: ET.Element, amendments: list[dict] | None = None) -> list[str]:
    """The text of an element, one line per block, list markers joined to their item.

    `modref` markers (consolidated texts) are dropped from the text and, when `amendments`
    is given, recorded there.
    """
    lines: list[str] = []
    current: list[str] = []

    def flush():
        line = normalise("".join(current))
        current.clear()
        if line:
            lines.append(line)

    def walk(node: ET.Element):
        name = local(node.tag)
        if _is_marker(node):
            if amendments is not None:
                anchor = next((a for a in node.iter() if a.get("title")), None)
                match = MODREF.match(anchor.get("title", "")) if anchor is not None else None
                if match:
                    amendments.append({"act": match.group(1),
                                       "action": (match.group(2) or "BASE").strip()})
            return
        if name in ("script", "style", "img") or _footnote_anchor(node):
            return
        block = name in BLOCK
        if block:
            flush()
        if {"superscript", "oj-super"} & classes(node):
            # A power (10^25): keep it readable instead of running the digits together.
            current.append("^")
        if node.text:
            current.append(node.text)
        for child in node:
            walk(child)
            if child.tail:
                current.append(child.tail)
        if block or name == "td":
            flush()

    walk(el)
    flush()
    lines = [re.sub(r"\s*\(\s*\)", "", line) for line in lines]
    # Join a bare list marker ("(a)", "1.", "—") to the line that follows it.
    joined: list[str] = []
    for line in lines:
        if joined and MARKER.match(joined[-1]):
            joined[-1] = f"{joined[-1]} {line}"
        else:
            joined.append(line)
    return [line for line in joined if line not in ("▼B", "▼M1")]


def _is_marker(node: ET.Element) -> bool:
    """A consolidated text's ▼ marker: `modref` names an amending act, `arrow` the base act."""
    return local(node.tag) == "p" and bool({"modref", "arrow"} & classes(node))


def _footnote_anchor(node: ET.Element) -> bool:
    """A footnote call: the OJ's `oj-note-tag`, or a consolidated text's `<a href="#E0002">`.

    Footnote numbers differ between renderings of the same act, so they are left out of the
    text; the footnotes themselves are references to other acts, not provisions.
    """
    if "oj-note-tag" in classes(node):
        return True
    return local(node.tag) == "a" and (node.get("href") or "").startswith("#E")


def _title(index: dict[str, ET.Element], key: str, node: ET.Element | None = None) -> str:
    el = index.get(key)
    if el is not None:
        return " ".join(block_lines(el))
    if node is None:
        return ""
    # Consolidated texts put a division's title in a plain paragraph after its number.
    for child in node:
        if local(child.tag) != "p":
            continue
        text = " ".join(block_lines(child))
        if text and not re.match(r"^(CHAPTER|SECTION|KAPITEL|AVSNITT)\b", text, re.I):
            return text
    return ""


def parse_act(xhtml: str | bytes) -> Act:
    root = ET.fromstring(xhtml.encode("utf-8") if isinstance(xhtml, str) else xhtml)
    index = {el.get("id"): el for el in root.iter() if el.get("id")}
    chapters: dict[str, str] = {}
    sections: dict[str, str] = {}
    provisions: list[Provision] = []
    # A ▼ marker holds until the next one: everything after `▼M1` comes from the amending act
    # until a `▼B` returns to the base text. `active` is the marker in force.
    state: dict = {"chapter": None, "section": None, "active": None}

    def visit(node: ET.Element):
        ident = node.get("id") or ""
        if _is_marker(node):
            seen: list[dict] = []
            block_lines(node, seen)
            if seen:
                state["active"] = seen[-1]
            return
        if m := CHAPTER.match(ident):
            state["chapter"], state["section"] = m.group(1), None
            chapters[m.group(1)] = _title(index, f"{ident}.tit_1", node)
        elif m := SECTION.match(ident):
            state["section"] = m.group(2)
            sections[f"{m.group(1)}.{m.group(2)}"] = _title(index, f"{ident}.tit_1", node)
        elif m := ARTICLE.match(ident):
            provisions.append(_provision(node, index, "article", m.group(1), state, chapters, sections))
            return
        elif m := RECITAL.match(ident):
            provisions.append(_provision(node, index, "recital", m.group(1), state, chapters, sections))
            return
        elif m := ANNEX.match(ident):
            state["chapter"], state["section"] = None, None
            provisions.append(_provision(node, index, "annex", m.group(1), state, chapters, sections))
            return
        for child in node:
            visit(child)

    visit(root)
    return Act(chapters, sections, provisions)


def _provision(node, index, kind, number, state, chapters, sections) -> Provision:
    ident = node.get("id")
    markers: list[dict] = []
    lines = block_lines(node, markers)
    at_start = [state["active"]] if state["active"] else []
    if markers:
        state["active"] = markers[-1]
    amendments = [m for m in at_start + markers if m["action"] != "BASE"]
    title = _title(index, f"{ident}.tit_1")
    # Drop the heading lines ("Article 6", the title) from the body.
    body = list(lines)
    if kind == "article":
        while body and (re.match(rf"^(Article|Artikel) {re.escape(number)}$", body[0]) or body[0] == title):
            body.pop(0)
    elif kind == "annex":
        if body and re.match(r"^(ANNEX|BILAGA) ", body[0], re.I):
            body.pop(0)
        if not title and body:
            title = body.pop(0)
        elif body and body[0] == title:
            body.pop(0)
    elif kind == "recital" and body:
        body[0] = re.sub(rf"^\({re.escape(number)}\)\s*", "", body[0])
    chapter = state["chapter"] if kind != "annex" else None
    section = state["section"] if kind != "annex" else None
    return Provision(
        provision_id=ident, kind=kind, number=number, title=title,
        chapter=chapter, chapter_title=chapters.get(chapter) if chapter else None,
        section=section,
        section_title=sections.get(f"{chapter}.{section}") if chapter and section else None,
        lines=body, amendments=_dedupe(amendments),
    )


def _dedupe(items: list[dict]) -> list[dict]:
    seen, out = set(), []
    for item in items:
        key = (item["act"], item["action"])
        if key not in seen:
            seen.add(key)
            out.append(item)
    return out


# ---------------------------------------------------------------- derived from the text

DEFINITION = re.compile(r"^\((\d+[a-z]?)\)\s*[‘'](.+?)[’']\s+means:?\s*(.*)$")
ARTICLE_REF = re.compile(
    r"\bArticles?\s+(\d+[a-z]?)((?:\s*\(\w+\))*)((?:(?:,\s*|\s+and\s+|\s+or\s+|\s+to\s+)\d+[a-z]?(?:\s*\(\w+\))*)*)"
    r"(?!\s*(?:of|in)\s+(?:Regulation|Directive|Decision|the Treaty|the Charter|TFEU|TEU|Council|Commission))")
ANNEX_REF = re.compile(r"\bAnnex(?:es)?\s+([IVXL]+)\b")


def definitions(article: Provision) -> list[dict]:
    """The defined terms of a definitions article: point, term and the definition verbatim."""
    out: list[dict] = []
    for line in article.lines:
        if m := DEFINITION.match(line):
            out.append({"point": m.group(1), "term": m.group(2), "definition": m.group(3)})
        elif out:
            # A definition in points: "(45) 'law enforcement authority' means:" then (a), (b).
            out[-1]["definition"] = f"{out[-1]['definition']}\n{line}".strip()
    return out


def article_references(text: str) -> list[str]:
    """Article numbers of the same act a text refers to ("Articles 8 to 15" expands)."""
    found: list[str] = []
    for m in ARTICLE_REF.finditer(text):
        first = m.group(1)
        found.append(first)
        rest = m.group(3) or ""
        previous = first
        for sep, num in re.findall(r"(,\s*|\s+and\s+|\s+or\s+|\s+to\s+)(\d+[a-z]?)", rest):
            if sep.strip() == "to" and previous.isdigit() and num.isdigit():
                found.extend(str(n) for n in range(int(previous) + 1, int(num) + 1))
            else:
                found.append(num)
            previous = num
    return sorted(set(found), key=_number_key)


def annex_references(text: str) -> list[str]:
    return sorted(set(ANNEX_REF.findall(text)), key=roman)


def _number_key(number: str) -> tuple[int, str]:
    m = re.match(r"(\d+)(\D*)", number)
    return (int(m.group(1)), m.group(2)) if m else (0, number)


def roman(value: str) -> int:
    numerals = {"I": 1, "V": 5, "X": 10, "L": 50, "C": 100}
    total, previous = 0, 0
    for char in reversed(re.sub(r"[a-z]+$", "", value)):
        n = numerals.get(char, 0)
        total += -n if n < previous else n
        previous = max(previous, n)
    return total


def english_date(text: str) -> str | None:
    """'2 August 2026' -> '2026-08-02'; None when the text holds no such date."""
    m = re.search(r"\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|"
                  r"October|November|December)\s+(\d{4})\b", text)
    if not m:
        return None
    return f"{int(m.group(3)):04d}-{MONTHS[m.group(2).lower()]:02d}-{int(m.group(1)):02d}"


def compare(old: Act, new: Act, kinds: tuple[str, ...] = ("article", "annex")) -> list[dict]:
    """Provision by provision: inserted, deleted, amended or unchanged from `old` to `new`.

    A provision whose text in `new` is only a deletion mark (a dash line) counts as deleted. A
    text that differs with no amendment marker is `text_differs`, not claimed as an amendment.
    `acts` lists the amending acts the new text's markers name, when it has any.
    """
    rows = []
    old_by = {p.provision_id: p for p in old.provisions if p.kind in kinds}
    new_by = {p.provision_id: p for p in new.provisions if p.kind in kinds}
    for pid in sorted(set(old_by) | set(new_by), key=_provision_key):
        before, after = old_by.get(pid), new_by.get(pid)
        if after is not None and _only_deletion_mark(after):
            after_deleted = True
        else:
            after_deleted = False
        if before is None and after is not None:
            change = "inserted"
        elif after is None or after_deleted:
            change = "deleted"
        elif before.text_hash != after.text_hash:
            # Amended when a marker names the amending act; otherwise the two renderings differ
            # (a corrigendum, or how a quoted amendment to another act is laid out).
            change = "amended" if after.amendments else "text_differs"
        else:
            change = "unchanged"
        ref = after or before
        rows.append({
            "provision_id": pid,
            "kind": ref.kind,
            "number": ref.number,
            "title": ref.title,
            "change": change,
            "acts": sorted({a["act"] for a in (after.amendments if after else [])}),
            "actions": sorted({a["action"] for a in (after.amendments if after else [])}),
            "old_hash": before.text_hash if before else None,
            "new_hash": after.text_hash if after else None,
        })
    return rows


def _only_deletion_mark(p: Provision) -> bool:
    return all(re.fullmatch(r"[—–\-\s]+", line) for line in p.lines) if p.lines else True


def _provision_key(pid: str):
    kind, _, number = pid.partition("_")
    if kind == "anx":
        return (2, roman(number), number)
    order = {"art": 0, "rct": 1}.get(kind, 3)
    n = _number_key(number)
    return (order, n[0], n[1])
