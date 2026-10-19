"""SWEDEN B: ad-language counting dedupes repeated texts, counts matches and words, and the
exported break is the least-squares split."""
import importlib.util
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "platform/ingest/jobtech"))
sys.path.insert(0, str(ROOT / "platform/publish/sweden"))

import ad_language  # noqa: E402
from ingest_governance_terms import load_terms  # noqa: E402

spec = importlib.util.spec_from_file_location("export_language", ROOT / "platform/publish/sweden/export_language.py")
export_language = importlib.util.module_from_spec(spec)
spec.loader.exec_module(export_language)


def ad(id_, text, field="Data/IT", region="Stockholms län"):
    return {"id": id_, "published": "2024-03-01", "title": "Utvecklare", "text": text,
            "field": field, "region": region}


def test_repeated_texts_count_once_and_matches_are_counted():
    terms, _ = load_terms(ad_language.TERMS)
    ads = [
        ad("1", "Du är stresstålig och flexibel. Stresstålig igen."),
        ad("2", "Du är stresstålig och flexibel. Stresstålig igen."),  # same text
        ad("1", "duplicate id"),
        ad("3", "Erfarenhet av Python krävs."),
        ad(None, "Erfarenhet av Java krävs."),  # old archives: no id
        ad(None, "Erfarenhet av Go krävs."),
    ]
    totals, hits, examples, stats = ad_language.count(iter(ads), terms)
    cell = ("2024", "Data/IT", "Stockholms län")
    assert stats == {"ads_read": 6, "duplicate_ids": 1, "ads": 5, "distinct_texts": 4}
    assert totals[cell][:2] == [5, 4]
    assert hits[(*cell, "stress")] == [1, 2]
    assert hits[(*cell, "flexibility")] == [1, 1]
    assert hits[(*cell, "competence")] == [3, 3]
    assert {e["category"] for e in examples} == {"stress", "flexibility", "competence"}


def test_one_break_finds_the_level_shift():
    years = list(range(2006, 2016))
    values = [0.1] * 4 + [0.3] * 6
    result = export_language.one_break(years, values)
    assert result["first_year_after"] == 2010
    assert result["variance_explained"] == 1.0
    assert export_language.one_break(years[:5], values[:5]) is None
