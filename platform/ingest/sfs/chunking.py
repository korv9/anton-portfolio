"""Split a law's plain text from data.riksdagen.se into one passage per paragraph (§).

The text is the header, then blocks separated by blank lines with hard line breaks inside them:
"AVDELNING I." parts, "<n> kap. <heading>" chapters, unnumbered headings, and paragraphs that
start "<n>[ <letter>] § ". A paragraph usually ends with the act that last changed it, "Lag
(2019:937).", which is kept as `amended_by` and taken out of the text. Everything from the line
"Övergångsbestämmelser" on is left out, and so are repealed paragraphs ("Har upphävts genom
lag ..."). When a paragraph or chapter is in the text twice, marked "/Upphör att gälla U:<date>/"
and "/Träder i kraft I:<date>/", only the version in force on the fetch date is kept; an undated
marker ("den dag som regeringen bestämmer") is in the future. Riksdagen's text sometimes has a
paragraph twice with no marker (the coming version after the current one); the first is kept.
A paragraph longer than LONG characters becomes one passage per stycke, where a stycke keeps
its list items and the sentence a list breaks.

Ids: sfs-<year>-<number>-<chapter>-<§>[-<stycke>], or sfs-<year>-<number>-<§>[-<stycke>] for a
law without chapters; "3 a kap." and "5 b §" become 3a and 5b.
"""
from __future__ import annotations

import re

LONG = 1500
AVDELNING = re.compile(r"^AVDELNING ([A-Z]+|[IVXLC]+)\b\.?\s*(.*)$")
CHAPTER = re.compile(r"^(\d+(?: [a-z])?) kap\.(?:\s+(?!\d)(.*))?$")
PARAGRAPH = re.compile(r"^(\d+(?: [a-z])?) §(?:\s+(.*))?$")
MARKER = re.compile(r"^/(Rubriken |Kapitlet |Paragrafen )?(upphör att gälla U|träder i kraft I):"
                    r"([^/]*)/\s*", re.I)
# "12 i /Träder i kraft I:.../ §" and "11 a §/Träder ..." put the marker on the wrong side.
MISPLACED = re.compile(r"^(\d+(?: [a-z])?) ?(/[^/]*/) ?§ ?|^(\d+(?: [a-z])?) §(?=/)")
# A heading run into the paragraph's last line ("Lag (2010:467). Behandling") goes with it.
AMENDED = re.compile(r"\s*(?:Lag|Förordning|Kungörelse) \((\d{4}:\d+)\)\.?"
                     r"(?: [A-ZÅÄÖ][^.?\n]{0,80})?\s*$")
REPEALED = re.compile(r"^(?:Har|har) (?:upphävts|uphävts|upphört) genom|^Upphävd genom"
                      r"|^Ny beteckning")
# "13-27 §§ Har upphävts genom lag (1970:429)." and the like.
RANGE = re.compile(r"^\d+(?: [a-z])?(?:(?: ?[-–] ?|, | och )\d+(?: [a-z])?)+ §§")
LIST_ITEM = re.compile(r"^(?:\d+\.|\d+\)|[a-zåäö]\)|–|-) ")
ORDINAL = ["första", "andra", "tredje", "fjärde", "femte", "sjätte", "sjunde", "åttonde",
           "nionde", "tionde"]


def blocks(text: str) -> list[str]:
    """Blank-line-separated blocks with hard breaks joined; list items keep their own line."""
    out = []
    for raw in re.split(r"\n\s*\n", text.replace("\r\n", "\n")):
        lines = [re.sub(r"\s+", " ", line).strip() for line in raw.split("\n")]
        lines = [line for line in lines if line]
        if not lines:
            continue
        block = lines[0]
        for line in lines[1:]:
            block += ("\n" if LIST_ITEM.match(line) else " ") + line
        out.append(block)
    return out


def body(text: str) -> list[str]:
    """The blocks after the header (which ends at the "Källa:" line), up to the transitional
    provisions."""
    text = text.replace("\r\n", "\n")
    head = re.search(r"^Källa:.*$", text, re.M)
    out = []
    for block in blocks(text[head.end():] if head else text):
        if block == "Övergångsbestämmelser":
            break
        out.append(MISPLACED.sub(lambda m: f"{m.group(1)} § {m.group(2)} " if m.group(1)
                                 else f"{m.group(3)} § ", block, count=1))
    return out


def in_force(marker: re.Match | None, fetched: str) -> bool:
    if not marker:
        return True
    when = re.match(r"\s*(\d{4}-\d{2}-\d{2})", marker.group(3))
    started = bool(when) and when.group(1) <= fetched
    return not started if marker.group(2).lower().startswith("upphör") else started


def unmark(block: str) -> tuple[str, re.Match | None]:
    """The block without its leading markers, and the one that counts: a heading's marker
    (/Rubriken .../) says nothing about the text under it."""
    kept = None
    while match := MARKER.match(block):
        block = block[match.end():]
        if (match.group(1) or "").strip().lower() != "rubriken":
            kept = match
    return block, kept


def heading(block: str, following: str | None) -> bool:
    """An unnumbered heading: one short line without closing punctuation, followed by a
    paragraph, chapter, part or another heading."""
    if "\n" in block or len(block) > 160 or block[-1] in ".:;," or LIST_ITEM.match(block):
        return False
    following = following and unmark(following)[0]
    return not following or bool(PARAGRAPH.match(following) or CHAPTER.match(following)
                                 or AVDELNING.match(following) or heading(following, None))


def key(number: str) -> str:
    return number.replace(" ", "")


def newest(numbers: list[str]) -> str | None:
    return max(numbers, key=lambda n: tuple(int(x) for x in n.split(":")), default=None)


def paragraphs(text: str, *, sfs: str, name: str, fetched: str) -> list[dict]:
    """One dict per paragraph or stycke: id, law, title, avdelning, chapter, paragraph, stycke,
    text, amended_by."""
    law = "sfs-" + sfs.replace(":", "-")
    items, seen = [], set()
    current = avdelning = chapter = None
    chapter_ok = True

    def close() -> None:
        if not current:
            return
        styckes, amended = [], []
        for stycke in current["styckes"]:
            if match := AMENDED.search(stycke):
                amended.append(match.group(1))
                stycke = stycke[:match.start()].rstrip()
            if stycke:
                styckes.append(stycke)
        if not styckes or REPEALED.match(styckes[0]):
            return
        whole = "\n\n".join(styckes)
        parts = [(None, whole)] if len(whole) <= LONG else list(enumerate(styckes, 1))
        for number, part in parts:
            ident = "-".join(x for x in (law, chapter and key(current["chapter"]),
                                         key(current["paragraph"]), number and str(number)) if x)
            title = name + (f" {current['chapter']} kap." if current["chapter"] else "")
            title += f" {current['paragraph']} §"
            if number:
                title += f", {ORDINAL[number - 1] if number <= len(ORDINAL) else number} stycket"
            items.append({"id": ident, "law": sfs, "title": title, "avdelning": avdelning,
                          "chapter": current["chapter"], "paragraph": current["paragraph"],
                          "stycke": number, "text": part, "amended_by": newest(amended)})

    found = body(text)
    for index, raw in enumerate(found):
        following = found[index + 1] if index + 1 < len(found) else None
        block, outer = unmark(raw)
        if not block:
            continue
        if match := AVDELNING.match(block):
            close()
            current, avdelning, chapter = None, match.group(1), None
        elif (match := CHAPTER.match(block)) and "§" not in block:
            close()
            current, chapter = None, match.group(1)
            chapter_ok = in_force(outer or unmark(match.group(2) or "")[1], fetched)
        elif match := PARAGRAPH.match(block):
            close()
            rest, marker = unmark(match.group(2) or "")
            label, current = (chapter, match.group(1)), None
            if chapter_ok and in_force(marker or outer, fetched) and label not in seen:
                seen.add(label)
                current = {"chapter": chapter, "paragraph": match.group(1), "styckes": [rest]}
        elif RANGE.match(block):
            close()
            current = None
        elif current and (LIST_ITEM.match(block) or not current["styckes"][-1] or (
                block[0].islower() and current["styckes"][-1][-1] not in ".!?")):
            # A list item, or the rest of a sentence a list broke, belongs to its stycke.
            last = current["styckes"][-1]
            current["styckes"][-1] = f"{last}\n{block}" if last else block
        elif heading(block, following):
            close()
            current = None
        elif current:
            current["styckes"].append(block)
    close()
    return items
