"""The embedding step's budget: token cap, the UTC day's ledger and the neuron cap."""
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "nlp"))
import workers_ai as w


def test_affordable_stops_at_the_token_cap():
    assert w.affordable([100, 100, 100], max_tokens=250, spent=0) == 2
    assert w.affordable([100, 100, 100], max_tokens=300, spent=0) == 3


def test_affordable_stops_at_the_days_neurons():
    # 9,500 neurons cap, 9,499 spent: one neuron left is about 930 tokens.
    assert w.affordable([500, 500], max_tokens=10**9, spent=9499) == 1
    assert w.affordable([500], max_tokens=10**9, spent=9600) == 0


def test_spent_today_counts_only_the_current_utc_day(tmp_path):
    ledger = tmp_path / "ledger.jsonl"
    rows = [{"utc": "2026-10-13T23:59:00+00:00", "neurons_est": 9000},
            {"utc": "2026-10-14T00:01:00+00:00", "neurons_est": 12.5},
            {"utc": "2026-10-14T20:00:00+00:00", "neurons_est": 7.5}]
    ledger.write_text("\n".join(json.dumps(r) for r in rows) + "\n", encoding="utf-8")
    assert w.spent_today(ledger, datetime(2026, 10, 14, 21, tzinfo=timezone.utc)) == 20
