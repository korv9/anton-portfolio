"""The issue-debate analysis per party: utterances split over a debate's issue areas, and term
counts per party and over all parties, on small inputs checked by hand."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "publish"))

from issue_debates import term_tables, topic_weights  # noqa: E402


def test_topic_weights_split_a_debate_over_its_areas():
    debates = [
        {"issues": ["miljo"], "parties": {"MP": [3, 1], "S": [1, 0]}},
        {"issues": ["miljo", "ekonomi"], "parties": {"MP": [2, 2], "XX": [5, 0], "S": [0, 0]}},
    ]
    out = topic_weights(debates)
    assert set(out) == {"MP", "S"}  # unknown party and a silent party left out
    assert out["MP"]["debates"] == 2
    assert out["MP"]["utterances"] == 8
    assert out["MP"]["topics"] == {"miljo": 6.0, "ekonomi": 2.0}
    assert out["S"] == {"debates": 1, "utterances": 1, "topics": {"miljo": 1.0}}


def test_term_tables_keep_top_stems_and_count_them_for_all_parties():
    rows = [
        ("MP", "klimatet klimatet klimatet skatten Andersson"),
        ("S", "skatten skatten skatten klimatet"),
    ]
    parties, total = term_tables(rows, names={"andersson"}, top=5)
    # Kept only at least three times per party; names never.
    assert parties["MP"]["stems"] == {"klimat": 3}
    assert parties["S"]["stems"] == {"skatt": 3}
    assert parties["MP"]["words"] == 4
    assert parties["S"]["words"] == 4
    assert total["words"] == 8
    # Every kept stem is counted over all parties, also where a party used it under three times.
    assert total["stems"] == {"klimat": 4, "skatt": 4}
