"""The v4 corpus checks (ingest/symbolic/audit_corpus.py) and validity measures
(nlp/symbolic/validity.py) on small, hand-made inputs."""
import json
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "platform" / "ingest" / "symbolic"))
sys.path.insert(0, str(ROOT / "platform" / "nlp" / "symbolic"))

import audit_corpus  # noqa: E402
import validity  # noqa: E402

TEXT = " ".join(f"word{i}" for i in range(400))


def test_a_reprinted_text_is_contained_and_an_unrelated_one_is_not():
    other = " ".join(f"other{i}" for i in range(400))
    a, b, c = audit_corpus.shingles(TEXT), audit_corpus.shingles(TEXT + " " + other), audit_corpus.shingles(other)
    assert a  # the hash sample keeps about one shingle in eight of 393
    assert len(a & b) / len(a) == 1.0
    assert not a & c


def test_titles_match_on_their_first_words_whatever_the_punctuation():
    assert audit_corpus.same_title("Korean folk tales: Imps, ghosts and fairies",
                                   "Korean folk tales Imps, ghosts and fairies")
    assert not audit_corpus.same_title("The Iliad", "The Odyssey")


def test_the_body_is_read_between_gutenbergs_start_and_end_lines():
    text = "header\n*** START OF THE PROJECT GUTENBERG EBOOK X ***\nthe tale\n*** END OF THE PROJECT GUTENBERG EBOOK X ***\nlicence"
    assert audit_corpus.body(text).strip() == "the tale"


def test_the_corpus_is_complete_and_unique():
    corpus = json.loads((ROOT / "platform/ingest/symbolic/corpus.json").read_text())["documents"]
    assert len({d["id"] for d in corpus}) == len(corpus)
    assert len({d["gutenberg_id"] for d in corpus}) == len(corpus)
    assert sum(d["pilot"] for d in corpus) == 10
    for d in corpus:
        assert all(d.get(k) for k in audit_corpus.REQUIRED), d["id"]
        assert d["source_type"] in audit_corpus.SOURCE_TYPES
        assert d["period"] in audit_corpus.PERIODS
        assert d["rights"] == "Public domain in the USA."


def test_identical_book_distributions_are_fully_similar_and_disjoint_ones_not():
    p = np.array([0.5, 0.5, 0.0])
    assert validity.js_similarity(p, p) == 1.0
    assert validity.js_similarity(np.array([1.0, 0, 0]), np.array([0, 1.0, 0])) == 0.0


def test_book_pairs_group_by_what_the_books_share():
    rows = []
    for book, voice, cluster in [("a", "Butler", 0), ("b", "Butler", 0), ("c", "Lang", 1)]:
        for _ in range(validity.MIN_POINTS):
            rows.append({"cluster_id": cluster, "document_id": book, "english_voice": voice,
                         "tradition": "t", "genre": "g", "source_type": "s", "period": "p"})
    out = validity.book_pairs(rows)["mean_similarity"]
    assert out["same_english_voice"] == {"pairs": 1, "mean": 1.0}
    assert out["same_tradition"]["pairs"] == 3
