"""The start page's four platform figures, summed from the schema export's nodes."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "publish"))
sys.path.insert(0, str(ROOT / "lib"))

from export_schema import summary  # noqa: E402


def test_summary_counts_models_sources_and_rows():
    nodes = [
        {"kind": "model", "rows": 10},
        {"kind": "model", "rows": None},  # a view: not counted
        {"kind": "source", "rows": 5},
        {"kind": "seed", "rows": 2},
    ]
    assert summary(nodes, {"source": 1, "gold": 2}, tests=7) == {
        "models": 2,
        "tests": 7,
        "sources": 1,
        "rows": 17,
    }
