"""Scan text for the pattern-matchable signs of AI writing in references/signs.md.

    python3 check_ai_signs.py <file(s)>          # .txt, .md or .html; "-" reads stdin
    python3 check_ai_signs.py <file> --summary   # counts per sign only

Each hit is the sentence that matched, under its sign number. Rule of three, elegant variation,
puffed-up structure and summary endings need a human read; this only finds wording and
formatting. Exits 1 when anything matched.
"""
from __future__ import annotations

import re
import sys
from collections import Counter

W = r"\b(?:{})\b"


def words(*terms: str) -> re.Pattern:
    return re.compile(W.format("|".join(terms)), re.I)


# (sign, name, pattern); sentence-level patterns run on prose, line-level ones on raw lines.
SENTENCE = [
    ("1.1", "Undue significance", words(
        r"stands as", r"serves as a (?:testament|reminder)", r"(?:is|a) testament", r"pivotal (?:role|moment)",
        r"(?:crucial|vital|significant|key) (?:role|moment)", r"reflects? broader", r"enduring legacy",
        r"lasting legacy", r"setting the stage for", r"marks? a shift", r"key turning point",
        r"evolving landscape", r"focal point", r"indelible mark", r"deeply rooted",
        r"underscores? (?:its|the) importance", r"highlights? (?:its|the) importance")),
    ("1.2", "Canned notability", words(
        r"independent coverage", r"(?:local|national) media outlets", r"trade publications",
        r"(?:featured|profiled|cited) in", r"active social media presence", r"leading expert")),
    ("1.3", "Superficial -ing analysis", re.compile(
        r",\s+(?:highlighting|underscoring|emphasi[sz]ing|ensuring|reflecting|symboli[sz]ing|"
        r"contributing to|cultivating|fostering|encompassing|enhancing|showcasing)\b|"
        r"\bvaluable insights\b|\bresonates? with\b", re.I)),
    ("1.4", "Promotional tone", words(
        r"boasts?", r"vibrant", r"rich (?:culture|cultural|heritage|history)", r"nestled",
        r"in the heart of", r"groundbreaking", r"renowned", r"diverse array", r"breathtaking",
        r"stunning", r"world-class", r"seamless(?:ly)?", r"state-of-the-art", r"commitment to",
        r"natural beauty", r"exemplif(?:y|ies)")),
    ("1.5", "Vague attribution", words(
        r"experts (?:say|argue|agree|note)", r"observers (?:note|have (?:noted|cited))",
        r"studies (?:show|suggest)", r"widely regarded", r"industry reports", r"some critics argue",
        r"several sources")),
    ("1.6", "Challenges formula", words(r"despite these challenges", r"faces (?:several|many|numerous) challenges")),
    ("1.7", "Title-defining lead", re.compile(r"^\s*[A-Z][\w\s-]{0,60}\s+refers to\b")),
    ("2.1", "AI vocabulary", re.compile(
        r"(?:^|(?<=[.!?]\s))Additionally\b|" + W.format("|".join([
            r"crucial", r"delve[sd]?", r"delving", r"bolstered", r"garner(?:ed)?", r"intricac(?:y|ies)",
            r"intricate", r"interplay", r"meticulous(?:ly)?", r"pivotal", r"underscores?", r"tapestry",
            r"enhance[sd]?", r"foster(?:s|ed|ing)?", r"robust", r"landscape", r"align(?:s)? with",
            r"showcas(?:e|es|ed|ing)", r"emphasi[sz]ing"])), re.I)),
    ("2.2", "Copula avoidance", words(r"serves as", r"functions as", r"operates as", r"stands as")),
    ("2.3", "Vague association", words(r"associated with", r"in connection with")),
    ("2.4", "Negative parallelism", re.compile(
        r"\bnot only\b.*\bbut\b|\b(?:it'?s|this is|is) not (?:just|merely|only)\b|"
        r"\b(?:it|this) isn'?t\b[^.]*,\s*(?:it'?s|but)\b|\bno \w+, no \w+, just\b|\brather than\b", re.I)),
    ("4.1", "Chat leftovers", words(
        r"I hope this helps", r"certainly!", r"great question", r"let me know if", r"would you like me to",
        r"in this section,? we will")),
    ("4.2", "Cutoff disclaimer", words(
        r"as of my last update", r"not widely (?:documented|disclosed|known)", r"specific details (?:are|about)",
        r"based on (?:the )?available information", r"maintains a low profile")),
    ("5.1", "Didactic disclaimer", words(
        r"it'?s important to (?:note|remember|consider)", r"it is important to (?:note|remember|consider)",
        r"it is worth noting", r"it'?s worth noting", r"may vary", r"keep in mind")),
    ("5.2", "Section summary", re.compile(r"(?:^|(?<=[.!?]\s))(?:In summary|In conclusion|Overall|Ultimately),", re.I)),
]

LINE = [
    ("3.1", "Title Case heading", re.compile(r"^#{1,6}\s+(?:[A-Z][a-z]+\s+){2,}(?:[A-Z][a-z]+)\s*$")),
    ("3.3", "Bold-label bullet", re.compile(r"^\s*[-*]\s+\*\*[^*]+:?\*\*:?")),
    ("3.4", "Em dash", re.compile("—")),
    ("3.5", "Emoji as formatting", re.compile(r"^\s*(?:#{1,6}\s*|[-*]\s*)?[\U0001F300-\U0001FAFF☀-➿]")),
    ("3.8", "Thematic break", re.compile(r"^\s*-{3,}\s*$")),
    ("4.3", "Placeholder", re.compile(r"\[(?:Your|Insert|Describe)[^\]]*\]|INSERT_\w+|\b\d{4}-XX-XX\b", re.I)),
]


def text_of(path: str) -> str:
    raw = sys.stdin.read() if path == "-" else open(path, encoding="utf-8").read()
    if path.endswith((".html", ".htm")):
        raw = re.sub(r"(?is)<(script|style)\b.*?</\1>", " ", raw)
        raw = re.sub(r"<[^>]+>", "\n", raw)
    return raw


def scan(text: str) -> list[tuple[str, str, str]]:
    hits = []
    lines = text.splitlines()
    for line in lines:
        for sign, name, pattern in LINE:
            if pattern.search(line):
                hits.append((sign, name, line.strip()))
    # Inside fenced code blocks nothing is prose.
    prose = re.sub(r"(?s)```.*?```", " ", text)
    sentences = re.split(r"(?<=[.!?])\s+|\n{2,}|\n(?=\s*[-*#])", prose)
    for sentence in sentences:
        sentence = " ".join(sentence.split())
        for sign, name, pattern in SENTENCE:
            if pattern.search(sentence):
                hits.append((sign, name, sentence))
    curly = bool(re.search("[“”’]", text))
    straight = bool(re.search(r"[\"']", re.sub(r"(?s)```.*?```", "", text)))
    if curly and straight:
        hits.append(("3.7", "Mixed curly and straight quotes", "(whole text)"))
    return sorted(hits, key=lambda h: [int(x) for x in h[0].split(".")])


def main(argv: list[str]) -> int:
    summary = "--summary" in argv
    paths = [a for a in argv if a != "--summary"] or ["-"]
    total = 0
    for path in paths:
        hits = scan(text_of(path))
        total += len(hits)
        print(f"== {path}: {len(hits)} hits")
        if summary:
            for (sign, name), n in sorted(Counter((s, n) for s, n, _ in hits).items(),
                                          key=lambda kv: [int(x) for x in kv[0][0].split(".")]):
                print(f"  {sign} {name}: {n}")
        else:
            for sign, name, where in hits:
                print(f"  {sign} {name}: {where[:160]}")
    return 1 if total else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
