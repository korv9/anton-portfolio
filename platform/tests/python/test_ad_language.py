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
    totals, hits, examples, stats, extra = ad_language.count(iter(ads), terms)
    cell = ("2024", "Data/IT", "Stockholms län", 0)  # every text is in the shortest length band
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


def test_dictionary_hash_ignores_line_endings(tmp_path):
    lf = ad_language.TERMS.read_bytes().replace(b"\r\n", b"\n")
    (tmp_path / "lf.csv").write_bytes(lf)
    (tmp_path / "crlf.csv").write_bytes(lf.replace(b"\n", b"\r\n"))
    assert load_terms(tmp_path / "lf.csv")[1] == load_terms(tmp_path / "crlf.csv")[1]


def test_length_bands_subterms_and_mix():
    terms, _ = load_terms(ad_language.TERMS)
    subterms, _ = ad_language.load_subterms()
    long = " ".join(["ord"] * 300)
    ads = [dict(ad("1", "Vi söker dig som är engagerad och brinner för kunder. Engagemang krävs. " + long),
                employer="Proffice Bemanning AB", group="4115"),
           dict(ad("2", "Personlig lämplighet och karriär."), employer="Kommunen", group="2341")]
    totals, hits, _, _, extra = ad_language.count(iter(ads), terms, subterms)
    assert ("2024", "Data/IT", "Stockholms län", 3) in totals  # more than 275 words
    long_cell = ("2024", "Data/IT", "Stockholms län", 3)
    assert hits[(*long_cell, "passion")] == [1, 3]
    assert hits[(*long_cell, "passion_engage")] == [1, 2]
    assert hits[(*long_cell, "passion_core")] == [1, 1]
    short = ("2024", "Data/IT", "Stockholms län", 0)
    assert hits[(*short, "identity")] == [1, 2]
    assert hits[(*short, "identity_formula")] == [1, 1] and hits[(*short, "identity_other")] == [1, 1]
    assert extra["mix"][("2024", "4115", "agency")][0] == 1
    assert extra["mix"][("2024", "2341", "other")][0] == 1
    assert extra["employers"] == {"Proffice Bemanning AB": 1}
    assert {c["category"] for c in extra["coding"]} >= {"passion", "identity"}


def test_subterms_split_their_parent_exactly():
    """Every alternative of passion and identity belongs to exactly one sub-term."""
    terms = dict(load_terms(ad_language.TERMS)[0])
    subterms, _ = ad_language.load_subterms()
    words = {"passion": ["passionerad", "brinner", "brinnande", "engagerad", "engagemang", "entusiastisk",
                         "glödande", "hjärta för", "enthusiastic"],
             "identity": ["personlig utveckling", "personlig lämplighet", "personliga egenskaper",
                          "din personlighet", "vem du är", "utvecklas som person", "växa med oss",
                          "karriär", "självförverkligande", "personal development",
                          "personal suitability", "grow with us", "career"]}
    for parent, examples in words.items():
        for w in examples:
            match = terms[parent].search(w)
            assert match, w
            owners = [s for s, p in subterms[parent] if p.fullmatch(match.group(0))]
            assert len(owners) == 1, (w, owners)


def test_shift_share_adds_up_and_separates_mix():
    sys.path.insert(0, str(ROOT / "platform/publish/sweden"))
    from language_stats import shift_share

    # Two groups with unchanged rates: the whole change is mix.
    before = {"a": (100, 10), "b": (100, 50)}
    after = {"a": (50, 5), "b": (150, 75)}
    r = shift_share(before, after)
    assert abs(r["within"]) < 1e-12 and abs(r["mix"] - (r["after"] - r["before"])) < 1e-12
    # Unchanged weights: the whole change is within; a new group adds to the mix only.
    r = shift_share({"a": (100, 10)}, {"a": (100, 30), "c": (100, 0)})
    assert abs(r["within"] + r["mix"] - (r["after"] - r["before"])) < 1e-12
    assert r["groups"] == 2


def test_coding_draw_is_reproducible_and_scores_agreement():
    sys.path.insert(0, str(ROOT / "platform/publish/sweden"))
    import language_coding as lc

    pool = [{"category": "passion", "year": str(2008 + i % 2 * 12), "rank": i, "context": "brinner för",
             "subterm": None, "archive": "x", "field": None, "employer_type": "other", "headline": "",
             "matched": "brinner"} for i in range(60)]
    pool.append({**pool[0], "context": "kontakta oss", "rank": -1})  # near contact details: skipped
    sample = lc.draw(pool)
    assert len(sample) == 2 * lc.PER
    assert [s["sample_id"] for s in sample] == [s["sample_id"] for s in lc.draw(list(reversed(pool)))]
    assert all(s["context"] == "brinner för" for s in sample)
    assert lc.kappa([1, 1, 0, 0], [1, 1, 0, 0]) == 1.0
    assert lc.kappa([1, 0, 1, 0], [1, 1, 0, 0]) == 0.0
    low, high = lc.wilson(8, 10)
    assert 0.44 < low < 0.5 and 0.94 < high < 0.97
