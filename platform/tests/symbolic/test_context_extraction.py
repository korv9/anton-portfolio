"""The symbol context extractor: whole-word alias matching, three-sentence windows that stop at
the document's edges, one occurrence per word even when aliases overlap, and stable ids."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "nlp/symbolic"))

from context import extract, find_matches, occurrence_id, sentence_spans  # noqa: E402

ALIASES = {"snake": "snake", "serpent": "snake", "serpents": "snake", "sea serpent": "sea",
           "moon": "moon", "wolf": "wolf", "wolves": "wolf"}


def test_aliases_match_whole_words_in_any_case():
    text = "The Serpent slept. A serpentine path. Two serpents and the MOON."
    found = [(m[2], m[3]) for m in find_matches(text, ALIASES)]
    assert found == [("snake", "Serpent"), ("snake", "serpents"), ("moon", "MOON")]


def test_overlapping_aliases_count_once_with_the_longer_match():
    found = find_matches("A sea serpent rose.", ALIASES)
    assert [(m[2], m[3]) for m in found] == [("sea", "sea serpent")]


def test_context_is_previous_matching_and_next_sentence():
    text = "First line. Then the wolf came! Last words? Far away."
    (occ,) = extract("doc", text, ALIASES)
    assert occ.sentence == "Then the wolf came!"
    assert occ.previous_sentence == "First line."
    assert occ.next_sentence == "Last words?"
    assert occ.context == "First line. Then the wolf came! Last words?"
    assert text[occ.char_start:occ.char_end] == "wolf"


def test_context_stops_at_the_start_and_end_of_a_document():
    first, last = extract("doc", "The moon rose. Nothing else. The wolves ran", ALIASES)
    assert first.previous_sentence == "" and first.next_sentence == "Nothing else."
    assert last.next_sentence == "" and last.sentence == "The wolves ran"
    assert last.context == "Nothing else. The wolves ran"


def test_a_long_verse_sentence_is_cut_around_the_match():
    text = " ".join(["word"] * 300) + " the serpent " + " ".join(["word"] * 300) + "."
    (occ,) = extract("doc", text, ALIASES)
    assert "serpent" in occ.sentence
    assert len(occ.sentence) <= 430
    assert occ.sentence.startswith("…") and occ.sentence.endswith("…")


def test_ids_are_stable_and_distinct():
    text = "A wolf. A wolf."
    a = extract("doc", text, ALIASES)
    b = extract("doc", text, ALIASES)
    assert [o.occurrence_id for o in a] == [o.occurrence_id for o in b]
    assert len({o.occurrence_id for o in a}) == 2
    assert a[0].occurrence_id == occurrence_id("doc", 2, "wolf")
    assert extract("other", text, ALIASES)[0].occurrence_id != a[0].occurrence_id


def test_sentences_cover_the_text_without_white_space():
    text = '  "Is it?" she said.  Yes.  '
    assert [text[s:e] for s, e in sentence_spans(text)] == ['"Is it?"', "she said.", "Yes."]
