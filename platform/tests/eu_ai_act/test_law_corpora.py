"""platform/publish/workers_ai/export_law_corpora.py: the AI Act split per paragraph and point."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "publish" / "workers_ai"))

from export_law_corpora import split_provision, title  # noqa: E402

EN = """1. The following AI practices shall be prohibited:
(a) the first practice;
(h) the use of systems, unless strictly necessary for one of the following objectives:
(i) the targeted search;
(ii) the prevention;
(iii) the localisation.
Point (h) of the first subparagraph is without prejudice to Article 9.
2. Second paragraph."""

SV = """1. Följande ska vara förbjudna:
a) Det första.
b) Det andra.
ba) Det insatta.
c) Det tredje."""


def test_paragraphs_points_and_roman_subpoints():
    parts = dict(split_provision("art_5", EN, "en"))
    assert list(parts) == ["art_5-1", "art_5-1-a", "art_5-1-h", "art_5-2"]
    assert parts["art_5-1-h"].endswith("(iii) the localisation.")
    assert parts["art_5-1"].endswith("without prejudice to Article 9.")


def test_inserted_points_and_titles():
    parts = dict(split_provision("art_5", SV, "sv"))
    assert list(parts) == ["art_5-1", "art_5-1-a", "art_5-1-b", "art_5-1-ba", "art_5-1-c"]
    assert title("art_5-1-a", "en", "Prohibited AI practices") == \
        "Article 5(1)(a), Prohibited AI practices"
    assert title("art_5-1-a", "sv", "") == "Artikel 5.1 a"
    assert title("anx_III-1-a", "en", "") == "Annex III, point 1(a)"
    assert title("rct_12", "sv", "") == "Skäl 12"
