"""The Philosophy Atlas: the author's own text between markers, passages, balanced sampling."""
import json
import sys
from pathlib import Path

import pandas as pd
import pytest

PLATFORM = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PLATFORM / "nlp" / "philosophy"))
sys.path.insert(0, str(PLATFORM / "ingest" / "jobtech"))

from passages import MAX_WORDS, MIN_WORDS, find_line, own_text, passages  # noqa: E402

RAW = """Title: X
*** START OF THE PROJECT GUTENBERG EBOOK X ***
CONTENTS
 BOOK I
INTRODUCTION
The translator writes about the author at length, which is not the work.

BOOK I

The work itself begins here and argues a point.
NOTES
A translator's note.
*** END OF THE PROJECT GUTENBERG EBOOK X ***
licence"""


def test_own_text_keeps_only_the_work_between_markers():
    text, first, last = own_text(RAW, {"line": r"BOOK I", "occurrence": 2}, {"line": r"NOTES"})
    assert "translator writes" not in text and "translator's note" not in text
    assert "The work itself begins here" in text
    assert text.startswith("*** START OF") and "*** END OF" in text


def test_a_missing_marker_fails_loudly():
    with pytest.raises(ValueError):
        find_line(RAW.split("\n"), {"line": r"BOOK IX"})
    # A null occurrence (as JSON from the warehouse can carry) means the first.
    assert find_line(RAW.split("\n"), {"line": r"BOOK I", "occurrence": None}) == 3


def test_passages_join_short_paragraphs_and_split_long_ones():
    short = "\n\n".join(f"Sentence number {i} says something about virtue and reason." for i in range(30))
    out = passages(short)
    assert all(len(p.split()) >= MIN_WORDS // 2 for p in out)
    long = " ".join(f"This is sentence {i} of a very long paragraph about justice." for i in range(80))
    out = passages(long)
    assert len(out) > 1 and all(len(p.split()) <= MAX_WORDS + 20 for p in out)


def test_headings_and_numbers_are_dropped():
    out = passages("CHAPTER I.\n\nIV\n\n" + " ".join(["word"] * 70) + ".")
    assert len(out) == 1 and not out[0].startswith("CHAPTER")


def test_balanced_sample_caps_each_work_evenly():
    import importlib.util

    sys.path.insert(0, str(PLATFORM / "nlp" / "text"))
    spec = importlib.util.spec_from_file_location("philosophy_pipeline", PLATFORM / "nlp/philosophy/pipeline.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    balanced_sample, chance_rate, entropy = module.balanced_sample, module.chance_rate, module.entropy

    frame = pd.DataFrame({"document_id": ["a"] * 500 + ["b"] * 50, "position": list(range(500)) + list(range(50))})
    s = balanced_sample(frame, 100)
    assert (s.document_id == "a").sum() == 100 and (s.document_id == "b").sum() == 50
    assert s[s.document_id == "a"].position.max() == 499  # spread to the end of the work
    assert entropy([5, 5]) == pytest.approx(1.0) and entropy([10, 0]) == 0.0
    assert chance_rate(["a", "a", "b", "b"]) == pytest.approx(1 / 3)


def test_corpus_metadata_is_complete():
    corpus = json.loads((PLATFORM / "ingest/philosophy/corpus.json").read_text(encoding="utf-8"))["documents"]
    assert len({d["id"] for d in corpus}) == len(corpus) == len({d["author"] for d in corpus})
    for d in corpus:
        assert d["original_language"] and d["tradition"] and d["year"]
        if d["original_language"] != "en":
            assert d["translator"] or d.get("translator_note"), d["id"]


def test_governance_terms_and_masking():
    from ingest_governance_terms import load_terms, window
    import re

    terms, digest = load_terms()
    by = dict(terms)
    assert by["ai_act"].search("Kunskap om EU AI Act") and by["ai_act"].search("AI-förordningen")
    assert by["responsible_ai"].search("Responsible AI") and not by["ai_any"].search("Kaisa")
    assert len(digest) == 64
    text = "Kontakta anna@firma.se eller 070-123 45 67 om MLOps."
    m = re.search("MLOps", text)
    assert "[e-post]" in window(text, m) and "[telefon]" in window(text, m)
