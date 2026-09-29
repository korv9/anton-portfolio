"""The news summary keeps only what its sources carry: cited ids from the input, and parties
the cited items are tagged with."""
import importlib.util
from pathlib import Path

spec = importlib.util.spec_from_file_location(
    "summarize_news", Path(__file__).resolve().parents[2] / "publish/summarize_news.py"
)
summarize_news = importlib.util.module_from_spec(spec)
spec.loader.exec_module(summarize_news)

ITEMS = [
    {"id": "a", "parties": ["S"]},
    {"id": "b", "parties": ["M", "KD"]},
]


def test_ground_drops_unknown_ids_and_untagged_parties():
    result = summarize_news.ground(
        {
            "headline": "h",
            "summary": "s",
            "themes": [
                {"title": "t1", "text": "x", "parties": ["S", "SD"], "item_ids": ["a", "zzz"]},
                {"title": "t2", "text": "y", "parties": ["M"], "item_ids": ["nope"]},
            ],
            "by_party": [
                {"party": "M", "text": "m", "item_ids": ["b"]},
                {"party": "V", "text": "v", "item_ids": ["a"]},
            ],
        },
        ITEMS,
    )
    assert result["themes"] == [
        {"title": "t1", "text": "x", "parties": ["S"], "item_ids": ["a"]}
    ]
    assert result["by_party"] == [{"party": "M", "text": "m", "item_ids": ["b"]}]


def test_no_key_means_no_call(monkeypatch, capsys):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.setattr("sys.argv", ["summarize_news.py"])
    assert summarize_news.main() == 0
    assert "not set" in capsys.readouterr().out
