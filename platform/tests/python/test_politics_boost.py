"""The politics boosting: features from the other parties and the committee, and a model per party
on a small session where one party always follows another."""
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "publish"))

pytest.importorskip("sklearn")
from politics_boost import PARTIES, fit_party, matrix  # noqa: E402


def session(n, flip=False):
    rows = []
    for i in range(n):
        s = "Ja" if i % 2 else "Nej"
        pos = {p: ("Ja" if (i + k) % 3 else "Nej") for k, p in enumerate(PARTIES)}
        pos["S"] = s
        pos["V"] = s  # V always votes as S
        rows.append({"committee": "FiU" if i % 4 else "JuU", "positions": pos})
    return rows


def test_matrix_codes_other_parties_and_committees():
    x, y, comm, others = matrix(session(4), "V", ["FiU", "JuU"])
    assert "V" not in others and len(others) == 7
    assert x.shape == (4, 9)
    assert set(x[:, :7].ravel()) <= {-1.0, 0.0, 1.0}
    assert list(y) == [0, 1, 0, 1]


def test_a_party_that_follows_another_is_learned_from_it():
    out = fit_party(session(80), session(40), "V", ["FiU", "JuU"])
    assert out["accuracy"] == 1.0
    assert max(out["importance"], key=out["importance"].get) == "S"
    assert out["staged"][-1] == 1.0
