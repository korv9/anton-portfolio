import re

import numpy as np
import pandas as pd

from ml.futures_topics import sentences
from ml.futures_topics.analyze import cross, holm, lagged, pairs_table
from ml.futures_topics.cluster import best_jaccard, centre
from ml.futures_topics.sentences import marked_sentence

MARKER = re.compile(r"\bframtid\w*", re.I)


def test_one_marked_sentence_of_six_to_eighty_words():
    text = "Herr talman! Framtiden.\nVi måste tänka på framtiden för barnen i hela landet. Kort om framtid."
    assert marked_sentence("a", text, MARKER) == (2, "Vi måste tänka på framtiden för barnen i hela landet.")
    assert marked_sentence("a", "Inget här om det som kommer sedan.", MARKER) is None
    many = " ".join(f"Framtiden är nummer {i} i en lång rad." for i in range(20))
    assert marked_sentence("a", many, MARKER) == (13, "Framtiden är nummer 13 i en lång rad.")


def test_sample_keeps_the_latest_version_of_each_document(tmp_path, monkeypatch):
    monkeypatch.setattr(sentences, "OUT", tmp_path / "text")
    monkeypatch.setattr(sentences, "RUN", tmp_path / "run")
    row = {"corpus": "diva", "year": 2010, "sentence_index": 0, "deleted": False}
    sentences.write([{**row, "key": "diva-2010-01", "doc_id": "gone", "sentence": "old"},
                     {**row, "key": "diva-2010-01", "doc_id": "kept", "sentence": "old"}], "diva-2010-01")
    sentences.write([{**row, "key": "diva-2011-01", "doc_id": "gone", "sentence": None, "deleted": True},
                     {**row, "key": "diva-2011-01", "doc_id": "kept", "sentence": "new"}], "diva-2011-01")
    sentences.sample()
    out = pd.read_parquet(tmp_path / "run/sample.parquet")
    assert out[["doc_id", "sentence"]].values.tolist() == [["kept", "new"]]


def test_holm_is_monotone_and_capped():
    assert np.allclose(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06])
    assert holm([0.9, 0.8]) == [1.0, 1.0]


def test_lag_direction_and_cross_null():
    a = np.array([0, 1, 0, 2, 0, 3, 0, 1, 0, 2.0])
    b = np.roll(a, 1)  # b follows a by one year
    assert lagged(a, b, 1) > 0.99
    rng = np.random.default_rng(0)
    out = cross(np.cumsum(rng.normal(size=21)), np.cumsum(rng.normal(size=21)), rng)
    assert 0 < out["p_lag0"] <= 1 and -3 <= out["best_lag"] <= 3


def test_centre_removes_corpus_means_and_jaccard_matches():
    v = np.array([[1, 0], [1, 0.2], [0, 1], [0.2, 1]], dtype=float)
    out = centre(v, np.array(["r", "r", "d", "d"]))
    assert np.allclose(np.linalg.norm(out, axis=1), 1)
    a, b = np.array([0, 0, 1, 1, -1]), np.array([1, 1, 0, 0, 0])
    assert best_jaccard(a, b) == {0: 1.0, 1: 2 / 3}


def test_no_riksdag_diva_pair_still_has_the_holm_columns():
    table = pairs_table([])
    assert {"p_lag0_holm", "p_best_lag_holm"} <= set(table.columns) and table.empty
