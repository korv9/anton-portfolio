"""The AI politics dictionary (seeds/ai_politics) and the paragraph matcher (nlp/text/concepts.py)."""
import csv
import sys
from pathlib import Path

import pytest

PLATFORM = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PLATFORM / "nlp" / "text"))
sys.path.insert(0, str(PLATFORM / "ingest" / "riksdagen"))

from concepts import Concept, match_paragraphs, paragraphs  # noqa: E402

ROWS = list(csv.DictReader((PLATFORM / "seeds/ai_politics/ai_politics_concepts.csv").open(encoding="utf-8")))
CONCEPTS = {r["concept_id"]: Concept.from_row(r["concept_id"], r["pattern"], r["case_sensitive"] == "true")
            for r in ROWS}


def test_ids_are_unique_and_kinds_known():
    ids = [r["concept_id"] for r in ROWS]
    assert len(ids) == len(set(ids))
    assert {r["kind"] for r in ROWS} == {"gate", "framing"}
    pairs = list(csv.DictReader((PLATFORM / "seeds/ai_politics/ai_politics_framing_pairs.csv").open(encoding="utf-8")))
    for p in pairs:
        assert p["concept_a"] in CONCEPTS and p["concept_b"] in CONCEPTS


@pytest.mark.parametrize("text, expected", [
    ("Vi måste satsa på AI i offentlig sektor.", True),
    ("AI-systemen används redan i vården.", True),
    ("Artificiell intelligens förändrar arbetsmarknaden.", True),
    ("Maskininlärning och språkmodeller", True),
    ("Det gäller Kai och Aida i kommunen.", False),        # the letters inside words do not count
    ("Det sades ai i förbifarten.", False),                 # lower-case 'ai' is not the abbreviation
    ("Vi behöver fler poliser i Malmö.", False),
])
def test_the_ai_gate(text, expected):
    assert bool(CONCEPTS["ai"].terms(text)) is expected


@pytest.mark.parametrize("concept, text", [
    ("ai_act", "AI-förordningen förhandlas nu i Bryssel."),
    ("ai_act", "EU:s förordning om artificiell intelligens"),
    ("innovation", "Sverige ska vara innovativt."),
    ("competitiveness", "Det handlar om vår konkurrenskraft."),
    ("safety", "AI måste vara säker och säkerheten måste öka."),
    ("security", "Cybersäkerheten och totalförsvaret måste stärkas."),
    ("risk", "Riskerna med tekniken är stora."),
    ("privacy", "Den personliga integriteten och GDPR."),
    ("surveillance", "Ansiktsigenkänning på allmän plats."),
    ("rights", "De mänskliga rättigheterna gäller även här."),
    ("transparency", "Det krävs öppenhet och transparens."),
    ("responsibility", "Vem bär ansvaret när det går fel?"),
    ("human_oversight", "Det måste finnas mänsklig kontroll."),
    ("automation", "Automatiserade beslut och algoritmer."),
    ("labour", "Vad betyder det för jobben och arbetsmarknaden?"),
    ("regulation", "Ett nytt regelverk och reglering behövs."),
    ("information", "Desinformation hotar demokratin."),
])
def test_each_concept_matches_its_own_words(concept, text):
    assert CONCEPTS[concept].terms(text), concept


def test_concepts_do_not_match_unrelated_words():
    assert not CONCEPTS["risk"].terms("Vi var på Kristianstads hotell.")
    assert CONCEPTS["labour"].terms("Jobbigt läge") == []  # 'jobbigt' is not 'jobb'
    assert CONCEPTS["labour"].terms("Fler jobb.") == ["jobb"]


def test_concepts_are_counted_only_in_ai_paragraphs():
    paras = ["Innovation i skogen är viktigt.", "AI kan driva innovation och tillväxt.", "Inget här."]
    rows = match_paragraphs(paras, CONCEPTS["ai"], [CONCEPTS["innovation"], CONCEPTS["competitiveness"]])
    assert [r["paragraph"] for r in rows] == [1]
    assert set(rows[0]["concepts"]) == {"innovation", "competitiveness"}


def test_paragraphs_from_riksdagen_html():
    html = "<p>Fru talman! AI &amp; jobb.</p><p></p><p>Andra stycket<br/>fortsätter.</p>"
    assert paragraphs(html) == ["Fru talman! AI & jobb.", "Andra stycket", "fortsätter."]


def test_speech_archives_from_the_catalogue():
    from ingest_speeches import archives

    page = ('<a href="https://data.riksdagen.se/dataset/anforande/anforande-201516.json.zip">'
            '<a href="https://data.riksdagen.se/dataset/anforande/anforande-202526.json.zip">'
            '<a href="https://data.riksdagen.se/dataset/anforande/anforande-201617.json.zip">')
    assert [c for c, _ in archives(page, "2016/17")] == ["201617", "202526"]
