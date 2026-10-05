"""Cluster review: paratext detection, the review priority, flags, diverse representatives,
c-TF-IDF suggestions, and that only human-reviewed labels are ever public."""
import sys
from pathlib import Path

import numpy as np
import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "nlp/symbolic"))

import rank_clusters as rc  # noqa: E402
import reviews  # noqa: E402

NARRATIVE = ("The old woman led the girl down to the river, where the water was dark and still, "
             "and told her that whoever crossed it would never come home again.")
GLOSSARY = ("Abydos, a town on the Hellespont. Acestes, son of a Trojan woman. Achates, the friend "
            "of Aeneas. Acetes, a sailor captured by Pentheus. Admetus, king of Thessaly.")
INDEX = "Aegir, 12, 45, 101; Agnar, 33, 34, 90; Alfadur, 2, 7, 18; see also Odin, 4-9, 112."
NOTES = "See Proverbial Expressions. Cf. Grimm, vol. 2, p. 114; ibid., chap. 3, MSS. Harleian."


def test_narrative_is_not_paratext():
    assert not rc.looks_like_paratext(NARRATIVE)


@pytest.mark.parametrize("text", [GLOSSARY, INDEX, NOTES])
def test_glossary_index_and_notes_are_paratext(text):
    assert rc.looks_like_paratext(text)


def test_glossary_entries_with_any_relation_are_paratext():
    text = ("Aegisthus, murderer of Agamemnon, slain by Orestes. Alecto, one of the Furies. "
            "Alfadur, a name for Odin. Anchises, beloved by Aphrodite.")
    assert rc.paratext_signals(text)["glossary_entries"]
    assert rc.looks_like_paratext(text)


def test_capitalised_headwords_are_paratext():
    text = "KERLAUG: ker, any kind of vessel. KJALARR, prob. a name of Odin. KORMT: a river."
    assert rc.paratext_signals(text)["headwords"] and rc.looks_like_paratext(text)


def test_one_genealogy_in_a_story_is_not_paratext():
    text = ("Odin, father of the gods, rode out at dawn. The wolf followed him through the forest, "
            "and the ravens flew ahead to the river where the giants waited.")
    assert not rc.looks_like_paratext(text)


def test_one_signal_is_not_enough():
    # Many names but no page numbers, glossary entries or editorial markers: a story about gods.
    text = "Odin and Thor and Freya and Loki rode to Asgard, where Frigga and Balder waited for Tyr."
    signals = rc.paratext_signals(text)
    assert signals["capitalised"] and sum(signals.values()) == 1
    assert not rc.looks_like_paratext(text)


def row(**kw):
    base = {"book_entropy": 0.8, "tradition_entropy": 0.7, "largest_book_share": 0.3,
            "avg_membership_probability": 0.9, "symbol_count": 6, "occurrence_count": 200,
            "cross_book_cluster": True}
    return {**base, **kw}


def test_review_priority_is_the_documented_weighted_mean():
    r = row()
    expected = 0.25 * 0.8 + 0.20 * 0.7 + 0.20 * 0.7 + 0.15 * 0.9 + 0.10 * 1.0 + 0.10 * 1.0
    assert rc.review_priority(r) == round(expected, 4)
    assert sum(rc.WEIGHTS.values()) == pytest.approx(1.0)


def test_review_priority_prefers_spread_and_penalises_one_book():
    spread = rc.review_priority(row())
    one_book = rc.review_priority(row(book_entropy=0.1, tradition_entropy=0.0, largest_book_share=0.95))
    assert spread > one_book
    assert 0 <= one_book <= 1 and 0 <= spread <= 1


def test_flags_and_review_class():
    assert rc.review_class(rc.flags(row(), 0.0)) == "candidate"
    assert rc.review_class(rc.flags(row(), 0.5)) == "reject"  # suspected paratext
    assert rc.review_class(rc.flags(row(occurrence_count=12), 0.0)) == "reject"  # too small
    assert rc.review_class(rc.flags(row(cross_book_cluster=False), 0.0)) == "warning"
    assert rc.review_class(rc.flags(row(avg_membership_probability=0.3), 0.0)) == "warning"
    f = rc.flags(row(cross_book_cluster=False), 0.0)
    assert f["book_dominated"] and not f["suspected_paratext"]


def test_fingerprint_follows_members_not_order():
    assert rc.fingerprint(["b", "a", "c"]) == rc.fingerprint(["c", "b", "a"])
    assert rc.fingerprint(["a", "b"]) != rc.fingerprint(["a", "b", "c"])


def test_diverse_representatives_cover_books_before_repeating():
    # Ten members nearest the centroid all from book A, then one each from B and C.
    ordered = list(range(12))
    books = ["A"] * 10 + ["B", "C"]
    probs = np.ones(12)
    picked = rc.diverse_representatives(ordered, books, probs, k=4)
    assert {books[i] for i in picked[:3]} == {"A", "B", "C"}
    assert picked[0] == 0 and len(picked) == 4


def test_diverse_representatives_prefer_strong_members():
    ordered = [0, 1, 2, 3]
    books = ["A", "B", "C", "D"]
    probs = np.array([1.0, 0.1, 1.0, 1.0])
    assert 1 not in rc.diverse_representatives(ordered, books, probs, k=3)


def test_centroid_order_is_by_distance():
    space = np.array([[0.0, 0.0], [10.0, 0.0], [1.0, 0.0], [2.0, 0.0]])
    ordered, dist = rc.centroid_order(space, np.array([0, 2, 3]))
    assert ordered.tolist() == [2, 0, 3] or ordered.tolist() == [2, 3, 0]
    assert list(dist) == sorted(dist)


def test_ctfidf_finds_the_distinctive_terms():
    rows = rc.ctfidf({0: ["the river water flowed", "river water rose"],
                      1: ["the fire burned bright", "fire and flame"]}, top=2)
    top = {r["cluster_id"]: r["term"] for r in rows if r["rank"] == 1}
    assert top[0] in {"river", "water"} and top[1] == "fire"


def test_analyse_marks_clusters_and_keeps_every_one():
    ids = [f"o{i}" for i in range(80)]
    labels = np.array([0] * 40 + [1] * 40)
    occ = {}
    for n, i in enumerate(ids):
        cross = n < 40
        occ[i] = {"occurrence_id": i, "document_id": f"book{n % 4}" if cross else "book0",
                  "title": "T", "tradition": f"t{n % 3}" if cross else "t0",
                  "symbol_id": ["river", "door", "fire"][n % 3], "matched_term": "river",
                  "context": NARRATIVE if cross else INDEX}
    run = {"ids": ids, "labels": labels, "probabilities": np.full(80, 0.9),
           "space": np.random.default_rng(0).normal(size=(80, 3))}
    result = rc.analyse(run, occ, "book_centered")
    by_id = {r["cluster_id"]: r for r in result["candidates"]}
    assert by_id[0]["review_class"] == "candidate" and by_id[0]["cross_book_cluster"]
    assert by_id[1]["suspected_paratext"] and by_id[1]["review_class"] == "reject"
    assert result["candidates"][0]["cluster_id"] == 0  # sorted by review priority
    assert all(r["review_status"] == "unreviewed" and r["review_label"] is None
               for r in result["candidates"])
    sets = {(p["cluster_id"], p["representative_set"]) for p in result["passages"]}
    assert sets == {(0, "centroid"), (0, "diverse"), (1, "centroid"), (1, "diverse")}
    diverse0 = [p for p in result["passages"] if p["cluster_id"] == 0 and p["representative_set"] == "diverse"]
    assert len({p["document_id"] for p in diverse0[:4]}) == 4
    summary = rc.summary(result, "book_centered")
    assert summary["suspected_paratext_count"] == 1 and summary["reviewed_cluster_count"] == 0


# ---------------------------------------------------------------------------- reviews


def entry(**kw):
    base = {"fingerprint": "fp1", "status": "reviewed", "label": "Threshold / passage",
            "description": "Crossing boundaries.", "confidence": "medium", "reviewed_by": "human",
            "notes": "private"}
    return {**base, **kw}


def test_review_file_validation():
    reviews.validate({"clusters": {"3": entry()}})
    with pytest.raises(reviews.ReviewError):
        reviews.validate({"clusters": {"3": entry(status="approved")}})
    with pytest.raises(reviews.ReviewError):
        reviews.validate({"clusters": {"3": entry(label="")}})
    with pytest.raises(reviews.ReviewError):
        reviews.validate({"clusters": {"3": entry(confidence="certain")}})
    with pytest.raises(reviews.ReviewError):
        reviews.validate({"clusters": {"3": entry(fingerprint=None)}})
    reviews.validate({"clusters": {"3": {"status": "candidate"}}})


def test_only_reviewed_labels_are_public_and_notes_stay_private():
    data = {"clusters": {"3": entry(), "4": entry(fingerprint="fp2", status="candidate"),
                         "5": entry(fingerprint="fp3", status="rejected")}}
    out = reviews.public(data, {"fp1": 17, "fp2": 4, "fp3": 5})
    assert [e["cluster_id"] for e in out] == [17]
    assert out[0]["label"] == "Threshold / passage" and "notes" not in out[0]


def test_stale_reviews_are_never_published():
    data = {"clusters": {"3": entry(fingerprint="gone")}}
    assert reviews.public(data, {"fp1": 3}) == []
    assert reviews.stale(data, {"fp1"}) == ["3"]


def test_the_shipped_review_file_has_no_invented_labels():
    data = reviews.load()
    assert all(e.get("status") != "reviewed" or e.get("reviewed_by") for e in data["clusters"].values())
