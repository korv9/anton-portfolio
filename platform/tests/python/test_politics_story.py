"""The politics story's precomputed figures: member deviation, tf-idf keywords and rising terms,
on small inputs where the answer can be checked by hand."""
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "publish"))
sys.path.insert(0, str(ROOT / "nlp"))

from politics_story import member_stats, per_10k, rising_terms, tfidf_terms  # noqa: E402


def test_member_stats_counts_votes_and_deviation():
    decisions = [
        {
            "parties": [{"party": "A", "party_position": "Ja"}],
            "members": [
                {"member_id": "1", "member_name": "Ett", "party": "A", "vote": "Ja"},
                {"member_id": "2", "member_name": "Två", "party": "A", "vote": "Nej"},
                {"member_id": "2", "member_name": "Två", "party": "A", "vote": "Nej"},  # duplicate
                {"member_id": "3", "member_name": "Tre", "party": "A", "vote": "Frånvarande"},
            ],
        },
        {
            "parties": [{"party": "A", "party_position": "Nej"}, {"party": "-", "party_position": None}],
            "members": [{"member_id": "2", "member_name": "Två", "party": "-", "vote": "Ja"}],
        },
    ]
    rows, quality = member_stats(decisions)
    by = {r["id"]: r for r in rows}
    assert quality["duplicate_member_vote"] == 1
    assert by["1"]["yes"] == 1 and by["1"]["deviating"] == 0 and by["1"]["compared"] == 1
    assert by["2"]["no"] == 1 and by["2"]["deviating"] == 1
    assert by["2"]["parties"] == ["A", "-"]
    assert by["2"]["compared"] == 1  # the independent vote has no party position to compare
    assert by["3"]["absent"] == 1 and by["3"]["compared"] == 0
    assert quality["members_in_more_than_one_party"] == 1


def test_per_10k():
    assert per_10k(5, 10_000) == 5
    assert per_10k(1, 0) == 0


def test_tfidf_prefers_words_only_one_document_uses():
    docs = {
        "a": Counter({"skatt": 10, "gemensam": 10}),
        "b": Counter({"vård": 10, "gemensam": 10}),
    }
    df = Counter({"skatt": 1, "vård": 1, "gemensam": 2})
    out = tfidf_terms(docs, df, 2, exclude={"vård"})
    assert [k["stem"] for k in out["a"]] == ["skatt"]  # 'gemensam' is in every document
    assert out["b"] == []  # 'vård' excluded


def test_rising_terms_normalises_for_text_length():
    now = Counter({"uran": 30, "skola": 30, "x": 940})
    before = Counter({"uran": 10, "skola": 300, "x": 9690})
    out = rising_terms(now, before, min_count=10, top=2)
    assert out["rising"][0]["stem"] == "uran"
    assert out["falling"][0]["stem"] == "x" or out["falling"][0]["stem"] == "skola"
    assert out["words_now"] == 1000 and out["words_before"] == 10_000
    skola = next(r for r in out["rising"] + out["falling"] if r["stem"] == "skola")
    assert skola["now"] == 300 and skola["before"] == 300  # same rate per 10,000 words
