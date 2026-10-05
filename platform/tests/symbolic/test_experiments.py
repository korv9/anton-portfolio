"""The deconfounding experiments' building blocks: masking, document centering, entropy, the
cross-book rule, deterministic representatives and one shared sample for every experiment."""
import sys
from pathlib import Path

import duckdb
import numpy as np
import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "nlp/symbolic"))

import evaluation as ev  # noqa: E402
import experiments  # noqa: E402
import pipeline  # noqa: E402
from transforms import center_by_document, center_document_means, mask_symbol  # noqa: E402


def test_mask_replaces_the_matched_word_in_any_case():
    assert mask_symbol("The serpent rose.", "serpent") == "The [SYMBOL] rose."
    assert mask_symbol("The Serpent rose.", "serpent") == "The [SYMBOL] rose."
    assert mask_symbol("A SERPENT. Then a serpent!", "Serpent") == "A [SYMBOL]. Then a [SYMBOL]!"


def test_mask_leaves_other_words_and_other_aliases_alone():
    assert mask_symbol("A serpentine path, a snake.", "serpent") == "A serpentine path, a snake."
    assert mask_symbol("fire-sword and fires", "fire") == "[SYMBOL]-sword and fires"
    assert mask_symbol("No term here.", "") == "No term here."


def test_document_centering_removes_each_documents_mean():
    rng = np.random.default_rng(0)
    a = rng.normal(5.0, 1.0, size=(6, 4))
    b = rng.normal(-3.0, 1.0, size=(4, 4))
    vectors = np.vstack([a, b])
    docs = ["a"] * 6 + ["b"] * 4
    centred = center_document_means(vectors, docs)
    assert np.allclose(centred[:6].mean(axis=0), 0, atol=1e-12)
    assert np.allclose(centred[6:].mean(axis=0), 0, atol=1e-12)
    normalised = center_by_document(vectors, docs)
    assert np.allclose(np.linalg.norm(normalised, axis=1), 1, atol=1e-5)
    with pytest.raises(ValueError):
        center_document_means(vectors, docs[:-1])


def test_normalised_entropy_on_known_distributions():
    assert ev.normalized_entropy([100], 10) == 0.0
    assert ev.normalized_entropy([50, 50], 2) == pytest.approx(1.0)
    assert ev.normalized_entropy([50, 50], 4) == pytest.approx(0.5)
    assert ev.normalized_entropy([25, 25, 25, 25], 4) == pytest.approx(1.0)
    assert ev.normalized_entropy([5], 1) == 0.0


def test_cross_book_rule_uses_both_thresholds():
    assert ev.is_cross_book(3, 0.5)
    assert not ev.is_cross_book(2, 0.4)
    assert not ev.is_cross_book(5, 0.51)


def test_cluster_composition_and_summary():
    labels = np.array([0, 0, 0, 0, 1, 1, -1])
    books = ["a", "b", "c", "c", "d", "d", "x"]
    trads = ["n", "n", "g", "g", "f", "f", "n"]
    syms = ["s", "s", "s", "t", "u", "u", "s"]
    rows = ev.cluster_composition(labels, books, trads, syms)
    first = rows[0]
    assert (first["book_count"], first["largest_book"], first["largest_book_share"]) == (3, "c", 0.5)
    assert first["cross_book_cluster"] is True
    assert rows[1]["book_entropy"] == 0.0 and rows[1]["cross_book_cluster"] is False
    summary = ev.composition_summary(rows, len(labels))
    assert summary["cross_book_cluster_count"] == 1
    assert summary["cross_book_occurrence_share"] == round(4 / 7, 4)
    assert summary["clusters_with_3plus_books"] == 1
    assert summary["mean_largest_book_share"] == 0.75
    assert summary["weighted_mean_largest_book_share"] == round((0.5 * 4 + 1.0 * 2) / 6, 4)


def test_representatives_are_nearest_to_the_centroid_and_deterministic():
    space = np.array([[0.0, 0.0], [1.0, 0.0], [-1.0, 0.0], [5.0, 5.0], [9.0, 9.0]])
    labels = np.array([0, 0, 0, 1, -1])
    reps = ev.representatives(space, labels, top=2)
    assert reps == ev.representatives(space, labels, top=2)
    assert reps[0][:3] == (0, 1, 0)
    # The two points equally far from the centroid are ordered by row.
    assert reps[1][:3] == (0, 2, 1)
    assert [r[0] for r in reps] == [0, 0, 1]


def test_every_experiment_reads_the_same_sample(tmp_path):
    db = tmp_path / "w.duckdb"
    con = duckdb.connect(str(db))
    con.execute("create schema silver")
    con.execute("""create table silver.int_symbol_occurrences as
        select md5(i::varchar) as occurrence_id, 'The serpent ' || i as context,
               'doc' || (i % 5) as document_id, 'sym' || ((i // 5) % 5) as symbol_id,
               'trad' || (i % 2) as tradition, 'serpent' as matched_term
        from range(2000) t(i)""")
    con.close()
    first = experiments.load_sample(db)
    second = experiments.load_sample(db)
    assert len(first["ids"]) == 25 * pipeline.PER_PAIR
    assert first["ids"] == second["ids"]
    assert first["ids"] == [r[0] for r in pipeline.load(db)]
    assert experiments.sample_hash(first["ids"]) == experiments.sample_hash(second["ids"])
    masked = experiments.inputs(first, masking=True)
    assert all("[SYMBOL]" in m and "serpent" not in m for m in masked)
    assert experiments.inputs(first, masking=False) == first["contexts"]
