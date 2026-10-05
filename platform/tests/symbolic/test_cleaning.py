"""Paratext cleaning: boilerplate, contents, indexes, glossaries, notes and footnotes go;
narrative text, and the words "index", "notes" or "contents" in a sentence, stay."""
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "nlp/symbolic"))

import cleaning as cl  # noqa: E402
from cleaning_report import compare  # noqa: E402

PROSE = ("Once upon a time a king lived by the river, and his daughter walked each evening to the "
         "water. She saw the moon rise over the dark forest. The old woman at the door told her a "
         "story about a serpent and a golden bird, and she listened until the fire burned low.")


def book(*parts: str) -> str:
    """Parts joined the way Gutenberg books set them: sections apart by four blank lines."""
    return "\n\n\n\n\n".join(parts)


def narrative(n: int = 40) -> str:
    return "\n\n".join([PROSE] * n)


def wrap(body: str) -> str:
    return ("The Project Gutenberg eBook of Tales\n\nThis eBook is for the use of anyone.\n\n"
            "*** START OF THE PROJECT GUTENBERG EBOOK TALES ***\n\n" + body +
            "\n\n*** END OF THE PROJECT GUTENBERG EBOOK TALES ***\n\nSection 1. General Terms of Use.")


def test_gutenberg_header_footer_and_credit_are_removed():
    text = wrap("Produced by Some Volunteers\n\n" + narrative(2))
    body = cl.strip_gutenberg_boilerplate(text)
    assert "START OF THE PROJECT" not in body and "General Terms" not in body
    assert "Produced by" not in body
    assert body.lstrip().startswith("Once upon a time")


def test_text_without_markers_is_kept_whole():
    assert cl.strip_gutenberg_boilerplate(narrative(1)).strip() == PROSE


def test_table_of_contents_is_removed_up_to_the_first_prose():
    contents = "CONTENTS\n\n\n     I. THE GOLDEN BIRD\n    II. HANS IN LUCK\n   III. BRIAR ROSE\n    IV. RAPUNZEL"
    text, removed = cl.remove_table_of_contents(book("TALES", contents, "THE GOLDEN BIRD", narrative(3)))
    assert "HANS IN LUCK" not in text
    assert [r.kind for r in removed] == ["contents"]
    assert PROSE in text


def test_indented_titles_and_page_columns_count_as_contents():
    contents = ("CONTENTS\n\n\n        Chap.                         Page\n\n"
                "        I.   The Beginning              1\n        II.  Odin                      16\n\n"
                "     The Snow Queen\n     The Fir Tree")
    text, _ = cl.remove_table_of_contents(book(contents, narrative(2)))
    assert "Odin" not in text and "Snow Queen" not in text and PROSE in text


def test_index_with_page_numbers_is_removed():
    index = "INDEX\n\n" + "\n".join(f"Name{i}, {i}, {i + 10}, {i + 40}" for i in range(30))
    text, removed = cl.remove_index_sections(book(narrative(3), index))
    assert "Name12" not in text and [r.kind for r in removed] == ["index"]
    assert text.strip().endswith(PROSE)


def test_glossary_with_term_entries_is_removed():
    glossary = "GLOSSARY\n\n\n" + "\n\n".join(
        f"Term{chr(65 + i)}, a figure in the old tales" for i in range(20))
    text, removed = cl.remove_glossary_sections(book(narrative(3), glossary))
    assert "TermC" not in text and [r.kind for r in removed] == ["glossary"]


def test_one_line_glossary_entries_are_removed():
    glossary = "GLOSSARY\n\n\n" + "\n".join(f"Ah’to{i}. The god of the waters." for i in range(30))
    text, _ = cl.remove_glossary_sections(book(narrative(3), glossary))
    assert "Ah’to5" not in text


def test_a_heading_named_glossary_over_prose_is_kept():
    text, removed = cl.remove_glossary_sections(book("GLOSSARY", narrative(3)))
    assert removed == [] and PROSE in text


def test_late_notes_and_bibliography_are_removed():
    notes = "NOTES\n\n\n[1] \"Northern Mythology,\" Kauffmann.\n\n[2] Halliday Sparling.\n\n[3] Carlyle."
    bib = "BIBLIOGRAPHY\n\n\nHESIOD.—The classification of MSS. here followed is that of Rzach."
    text, removed = cl.remove_editorial_notes(book(bib, "THE WORKS", narrative(30), notes))
    assert "Kauffmann" not in text and "Rzach" not in text
    assert {r.heading for r in removed} == {"NOTES", "BIBLIOGRAPHY"}
    assert PROSE in text


def test_a_notes_chapter_early_in_the_story_stays():
    text, removed = cl.remove_editorial_notes(book("NOTES", narrative(3), "THE END", narrative(30)))
    assert removed == []
    assert text.count(PROSE) == 33


def test_footnote_blocks_are_removed_wherever_they_stand():
    text, removed = cl.remove_footnote_blocks(
        "The serpent rose.[Footnote 12: A note that runs\nover two lines.] And the moon set.")
    assert "Footnote" not in text and "moon set" in text and len(removed) == 1


@pytest.mark.parametrize("sentence", [
    "The old man kept an index of every star he had seen.",
    "She read the notes her mother left, and the contents of the box surprised her.",
    "Index and glossary meant nothing to the wolf.",
])
def test_paratext_words_in_prose_trigger_nothing(sentence):
    text = book(narrative(2), "\n\n".join([sentence] * 3), narrative(2))
    result = cl.clean_document(wrap(text), check=False)
    assert result.removals == []
    assert sentence in result.text


def test_index_word_at_line_start_inside_a_paragraph_is_not_a_heading():
    paragraph = "He opened the book.\nIndex\nfingers pointed at the page, and the river ran on."
    lines = book(paragraph, narrative(1)).split("\n")
    assert not any(cl.is_heading(lines, i) and lines[i] == "Index" for i in range(len(lines)))


def test_clean_document_collapses_white_space_and_keeps_order():
    text = wrap(book("CONTENTS\n\n\n   I. ONE\n  II. TWO", "First part.\nStill first.", narrative(30),
                     "Last words of the tale."))
    result = cl.clean_document(text, check=False)
    assert "\n" not in result.text and "  " not in result.text
    assert result.text.index("First part.") < result.text.index("Last words")
    assert result.sections_removed == ["contents:CONTENTS"]
    assert 0 < result.removed_share < 0.1


def test_documents_do_not_bleed_into_each_other():
    a = cl.clean_document(wrap(book(narrative(30), "INDEX\n\n" + "\n".join(f"A{i}, {i}, {i + 2}" for i in range(20)))),
                          check=False)
    b = cl.clean_document(wrap(narrative(30)), check=False)
    assert a.text == b.text


def test_gutting_a_book_raises():
    glossary = "GLOSSARY\n\n\n" + "\n".join(f"Term{i}, a figure in the old tales" for i in range(3000))
    with pytest.raises(cl.CleaningError):
        cl.clean_document(wrap(book(narrative(30), glossary)), {"document_id": "tiny"})


def test_comparison_counts_removed_occurrences_per_document():
    before = [("a", "fire", "x"), ("a", "fire", "x"), ("b", "moon", "y")]
    after = [("a", "fire", "x"), ("b", "moon", "y")]
    out = compare(before, after)
    assert out["old_occurrence_count"] == 3 and out["new_occurrence_count"] == 2
    assert out["removed_occurrences"] == 1 and out["documents_affected"] == ["a"]
    assert out["per_symbol"]["fire"] == {"before": 2, "after": 1, "change": -1}
    assert compare(None, after)["limitation"]
