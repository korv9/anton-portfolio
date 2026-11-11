"""Allegora's ranking (docs/products/allegora/allegora-gcp.md): the paragraph is the unit a question finds.

The index holds one passage per paragraph, or per stycke of a long one (chunking.py). A search
scores every passage, then walks them from the best down and keeps the first passage of each
paragraph until it has k paragraphs from at most MAX_LAWS laws. Each kept paragraph comes back
whole, all its stycken in order, cut to MAX_CHARS by dropping its lowest-scoring stycken.
Optionally the cosine ranking is fused with an FTS5 ranking (reciprocal rank fusion).
"""
from __future__ import annotations

import json
import re
import sqlite3

import numpy as np

STYCKE = re.compile(r", \S+ stycket$")
ANCHOR_STYCKE = re.compile(r"S\d+$")
MAX_LAWS, MAX_CHARS, POOL, RRF_K = 4, 4800, 400, 60


class Lines:
    """passages.jsonl as a list that parses a line only when it is read, so the service starts
    without parsing 105,000 lines. id, title and law, which every search needs, are read at once."""

    def __init__(self, raw: bytes):
        self.lines = raw.decode("utf-8").splitlines()
        self.parsed: dict[int, dict] = {}
        self.heads = [self.head(line) for line in self.lines]

    @staticmethod
    def head(line: str) -> tuple[str, str, str]:
        """id, title and law by position in the line as sfs_index.py writes it; json when a value
        holds an escape or the line has another shape."""
        a = line.find('", "title": "')
        b = line.find('", "url": "', a)
        c = line.rfind('"law": "')
        d = line.find('", "kind": "', c)
        if line.startswith('{"id": "') and min(a, b, c, d) > 0:
            values = line[8:a], line[a + 13:b], line[c + 8:d]
            if not any("\\" in v or '"' in v for v in values):
                return values
        p = json.loads(line)
        return p["id"], p["title"], p["law"]

    def __len__(self) -> int:
        return len(self.lines)

    def __getitem__(self, i: int) -> dict:
        if i not in self.parsed:
            self.parsed[i] = json.loads(self.lines[i])
        return self.parsed[i]


def paragraph_key(passage: dict) -> str:
    """The paragraph's id: a stycke's id without its stycke number."""
    return key_of(passage["id"], passage["title"])


def key_of(id: str, title: str) -> str:
    return id.rsplit("-", 1)[0] if STYCKE.search(title) else id


class Paragraphs:
    """Which paragraph each passage belongs to, and each paragraph's passages in order."""

    def __init__(self, passages: list[dict] | Lines):
        self.passages = passages
        heads = passages.heads if isinstance(passages, Lines) else [
            (p["id"], p["title"], p["law"]) for p in passages]
        self.law = [law for _, _, law in heads]
        index: dict[str, int] = {}
        self.of = np.empty(len(passages), dtype=np.int32)
        self.members: list[list[int]] = []
        for i, (id, title, _) in enumerate(heads):
            key = key_of(id, title)
            if key not in index:
                index[key] = len(self.members)
                self.members.append([])
            self.of[i] = index[key]
            self.members[index[key]].append(i)

    def whole(self, paragraph: int, scores: np.ndarray, score: float) -> dict:
        """One paragraph as a passage: every stycke, or the best ones that fit in MAX_CHARS."""
        members = self.members[paragraph]
        keep, size = [], 0
        for i in sorted(members, key=lambda i: -scores[i]):
            length = len(self.passages[i]["text"]) + 2
            if keep and size + length > MAX_CHARS:
                continue
            keep.append(i)
            size += length
        keep.sort()
        first = self.passages[members[0]]
        return {
            "id": paragraph_key(first),
            "title": STYCKE.sub("", first["title"]),
            "url": ANCHOR_STYCKE.sub("", first["url"]) if len(members) > 1 else first["url"],
            "text": "\n\n".join(self.passages[i]["text"] for i in keep)[:MAX_CHARS],
            "law": first["law"],
            "kind": first["kind"],
            "score": round(float(score), 4),
            "stycken": len(keep),
        }


def best(scores: np.ndarray) -> np.ndarray:
    """The POOL best passages by cosine, best first."""
    pool = np.argpartition(-scores, POOL)[:POOL] if len(scores) > POOL else np.arange(len(scores))
    return pool[np.argsort(-scores[pool])]


def rank(scores: np.ndarray, paragraphs: Paragraphs, k: int, max_laws: int = MAX_LAWS,
         order: np.ndarray | None = None) -> list[tuple[int, float]]:
    """The k best paragraphs as (paragraph, cosine of its best passage), one passage each,
    from at most max_laws laws. order is the passages' ranking when it is not the cosine."""
    if order is None:
        order = best(scores)
    out: list[tuple[int, float]] = []
    seen: set[int] = set()
    laws: set[str] = set()
    for i in order:
        paragraph = int(paragraphs.of[i])
        law = paragraphs.law[i]
        if paragraph in seen or (law not in laws and len(laws) >= max_laws):
            continue
        seen.add(paragraph)
        laws.add(law)
        out.append((paragraph, float(scores[i])))
        if len(out) == k:
            break
    return out


class Lexical:
    """An in-memory FTS5 index of the passages' titles and texts."""

    def __init__(self, passages: list[dict]):
        self.db = sqlite3.connect(":memory:", check_same_thread=False)
        self.db.execute("CREATE VIRTUAL TABLE p USING fts5(title, text, tokenize='unicode61')")
        self.db.executemany("INSERT INTO p(rowid, title, text) VALUES (?, ?, ?)",
                            ((i, p["title"], p["text"]) for i, p in enumerate(passages)))

    def search(self, question: str, n: int = POOL) -> list[int]:
        words = [w for w in re.findall(r"\w{3,}", question.lower())]
        if not words:
            return []
        query = " OR ".join(f'"{w}"' for w in words)
        rows = self.db.execute("SELECT rowid FROM p WHERE p MATCH ? ORDER BY bm25(p) LIMIT ?",
                               (query, n)).fetchall()
        return [r[0] for r in rows]


def fused(scores: np.ndarray, lexical: list[int]) -> np.ndarray:
    """The cosine top POOL and the FTS5 hits, ordered by reciprocal rank fusion."""
    dense = best(scores)
    total: dict[int, float] = {}
    for ranking in (dense.tolist(), lexical):
        for r, i in enumerate(ranking):
            total[i] = total.get(i, 0.0) + 1 / (RRF_K + r + 1)
    return np.array(sorted(total, key=lambda i: -total[i]), dtype=np.int64)
