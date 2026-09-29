"""The issue lexicon learns what sets an area apart, and scores compounds by their head."""
import importlib.util
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "lib"))
spec = importlib.util.spec_from_file_location("issue_lexicon", ROOT / "nlp/issue_lexicon.py")
L = importlib.util.module_from_spec(spec)
spec.loader.exec_module(L)


def rows(area, text, n):
    return [("2024/25", area, text)] * n


def test_learns_distinguishing_stems_and_scores_compounds(monkeypatch):
    monkeypatch.setattr(L, "MIN_COUNT", 2)
    training = (
        rows("utbildning", "skolorna skolorna skolorna lärarna eleverna betygen", 40)
        + rows("rattsvasende", "polisen polisen polisen brotten straffen gängen", 40)
    )
    lexicon = L.learn(training)
    assert "skol" in lexicon["utbildning"] and "polis" in lexicon["rattsvasende"]
    assert "skol" not in lexicon["rattsvasende"]
    heads = L.compound_index(lexicon)
    # "grundskolorna" is not in the lexicon, but its stem ends with "skol".
    scores = L.score("grundskolorna och straffen", lexicon, heads)
    assert scores["utbildning"] > 0
    assert max(scores, key=scores.get) == "utbildning"


def test_stop_words_and_party_names_are_not_topics():
    assert L.stems("Herr talman! Socialdemokraterna och regeringen") == []
