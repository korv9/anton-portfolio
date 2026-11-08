"""platform/publish/allegora/retrieval.py: Allegora finds paragraphs, not loose stycken."""
import json
import sys
from pathlib import Path

import numpy as np

sys.path.append(str(Path(__file__).resolve().parents[2] / "publish" / "allegora"))

from retrieval import Lexical, Lines, Paragraphs, fused, paragraph_key, rank  # noqa: E402

URL = "https://example.org/_sfs-1970-994/#K12P26"


def passage(pid: str, title: str, law: str, text: str = "text", url: str = URL) -> dict:
    return {"id": pid, "title": title, "url": url, "text": text, "law": law, "kind": "lag"}


ROWS = [
    passage("sfs-1-1-12-26-1", "Jordabalk 12 kap. 26 §, första stycket", "1970:994", "Tillträde."),
    passage("sfs-1-1-12-26-2", "Jordabalk 12 kap. 26 §, andra stycket", "1970:994", "I förväg.",
            URL + "S2"),
    passage("sfs-1-1-12-27", "Jordabalk 12 kap. 27 §", "1970:994"),
    passage("sfs-2-1", "Lag B 1 §", "2"),
    passage("sfs-3-1", "Lag C 1 §", "3"),
    passage("sfs-4-1", "Lag D 1 §", "4"),
    passage("sfs-5-1", "Lag E 1 §", "5"),
]
SCORES = np.array([0.9, 0.5, 0.8, 0.85, 0.84, 0.83, 0.82], dtype=np.float32)


def test_a_stycke_belongs_to_its_paragraph():
    assert paragraph_key(ROWS[0]) == "sfs-1-1-12-26"
    assert paragraph_key(ROWS[2]) == "sfs-1-1-12-27"
    # A paragraph number that is not a stycke keeps its last part.
    assert paragraph_key(passage("sfs-2005-59-2-10", "Lag 2 kap. 10 §", "2005:59")) \
        == "sfs-2005-59-2-10"


def test_one_hit_per_paragraph_from_at_most_four_laws():
    paragraphs = Paragraphs(ROWS)
    found = rank(SCORES, paragraphs, 8, max_laws=4)
    keys = [paragraphs.whole(p, SCORES, s)["id"] for p, s in found]
    # The second stycke of 26 § does not come back as its own hit; the fifth law is left out.
    assert keys == ["sfs-1-1-12-26", "sfs-2-1", "sfs-3-1", "sfs-4-1", "sfs-1-1-12-27"]
    assert [round(s, 2) for _, s in found][:2] == [0.9, 0.85]


def test_a_hit_is_the_whole_paragraph_in_order():
    paragraphs = Paragraphs(ROWS)
    whole = paragraphs.whole(0, SCORES, 0.9)
    assert whole["text"] == "Tillträde.\n\nI förväg."
    assert whole["title"] == "Jordabalk 12 kap. 26 §"
    assert whole["url"].endswith("#K12P26")
    assert whole["stycken"] == 2


def test_a_long_paragraph_keeps_its_best_stycken():
    long = [passage(f"sfs-9-1-{n}", f"Lag 1 §, {w} stycket", "9", w * 1000)
            for n, w in enumerate(["a", "b", "c", "d", "e", "f"], 1)]
    scores = np.array([0.1, 0.9, 0.2, 0.8, 0.3, 0.4], dtype=np.float32)
    whole = Paragraphs(long).whole(0, scores, 0.9)
    # 4,800 characters hold four stycken: the best four, in the paragraph's order.
    assert [part[0] for part in whole["text"].split("\n\n")] == ["b", "d", "e", "f"]


def test_fts_and_cosine_are_fused_by_rank():
    lexical = Lexical(ROWS)
    hits = lexical.search("förväg")
    assert hits == [1]
    scores = np.zeros(500, dtype=np.float32)
    scores[:7] = SCORES
    order = fused(scores, hits).tolist()
    # Passage 1 is ranked by both, so it rises above passages ranked only by the cosine.
    assert order.index(1) < order.index(6)


def test_lines_read_lazily_give_the_same_paragraphs():
    rows = ROWS + [passage("sfs-6-1", 'Lag "F" 1 §', "6")]
    scores = np.append(SCORES, 0.7).astype(np.float32)
    raw = "\n".join(json.dumps(r, ensure_ascii=False) for r in rows).encode("utf-8")
    lines = Lines(raw)
    assert lines.heads[-1] == ("sfs-6-1", 'Lag "F" 1 §', "6")
    assert not lines.parsed
    eager, lazy = Paragraphs(rows), Paragraphs(lines)
    found = [eager.whole(p, scores, s) for p, s in rank(scores, eager, 8)]
    assert found == [lazy.whole(p, scores, s) for p, s in rank(scores, lazy, 8)]
