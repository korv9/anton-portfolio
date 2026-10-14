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


def test_int8_search_keeps_the_nearest_neighbours():
    import numpy as np
    rng = np.random.default_rng(1)
    # Clustered data in 64 dimensions, compressed to 16: the exact neighbours mostly survive.
    centres = rng.normal(size=(20, 64))
    vectors = (centres[rng.integers(0, 20, 600)] + 0.3 * rng.normal(size=(600, 64))).astype("float32")
    fitted = w.pca(vectors, 16)
    codes = w.quantise(vectors, fitted)
    assert codes.dtype == np.int8 and codes.shape == (600, 16)
    assert np.abs(codes).max() == 127
    assert w.recall_at_10(vectors, fitted, codes, queries=100) > 0.5


def test_a_batch_stays_under_the_models_context():
    assert w.batch_size([10] * 300) == w.BATCH
    # 100 texts of 617 tokens are 61,700: too many for one call.
    lengths = [300] * 50 + [617] * 100
    n = w.batch_size(lengths)
    assert n * lengths[n - 1] <= w.BATCH_TOKENS and (n + 1) * lengths[n] > w.BATCH_TOKENS
    assert w.batch_size([90_000]) == 1
