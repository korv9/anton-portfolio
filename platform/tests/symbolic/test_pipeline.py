"""The Symbolic Atlas ML stage and export, without the heavy models: the pipeline refuses too
few occurrences, samples deterministically per book and symbol, writes a projection with the
columns the gold model reads, and the delivered atlas has every column the site uses."""
import json
import sys
from pathlib import Path

import duckdb
import numpy as np
import pyarrow.parquet as pq
import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "nlp/symbolic"))
sys.path.insert(0, str(ROOT / "publish/symbolic"))

import evaluation  # noqa: E402
import pipeline  # noqa: E402
from export_symbolic import ATLAS_COLUMNS, excerpt  # noqa: E402

DELIVERED = ROOT.parent / "frontend/public/data/symbolic"


def test_too_few_occurrences_are_refused():
    with pytest.raises(SystemExit):
        pipeline.check_size(10, minimum=500)
    pipeline.check_size(500, minimum=500)


def test_sampling_is_capped_per_book_and_symbol_and_deterministic(tmp_path):
    db = tmp_path / "w.duckdb"
    con = duckdb.connect(str(db))
    con.execute("create schema silver")
    con.execute("""create table silver.int_symbol_occurrences as
        select md5(i::varchar) as occurrence_id, 'context ' || i as context,
               'doc' || (i % 2) as document_id, 'sym' || (i % 3) as symbol_id
        from range(120) t(i)""")
    con.close()
    first = pipeline.load(db, per_pair=5)
    assert len(first) == 2 * 3 * 5
    assert first == pipeline.load(db, per_pair=5)
    assert [r[0] for r in first] == sorted(r[0] for r in first)


def test_projection_has_the_columns_the_gold_model_reads(tmp_path):
    path = tmp_path / "p.parquet"
    labels = np.array([0, -1, 1])
    pipeline.write_projection(path, ["a", "b", "c"], np.zeros((3, 2), np.float32), labels,
                              np.array([0.9, 0.0, 0.5], np.float32))
    table = pq.read_table(path)
    assert table.column_names == ["occurrence_id", "x", "y", "cluster_id", "cluster_probability", "is_noise"]
    assert table.column("is_noise").to_pylist() == [False, True, False]


def test_composition_measures_book_and_symbol_purity():
    labels = np.array([0, 0, 0, 0, 1, 1, -1])
    books = ["a", "a", "a", "b", "c", "c", "x"]
    symbols = ["s", "t", "u", "v", "s", "s", "s"]
    out = evaluation.composition(labels, books, symbols)
    assert out == {"largest_book_share": 0.875, "largest_symbol_share": 0.625}


def test_excerpt_is_short_and_keeps_the_word():
    text = "word " * 200 + "serpent " + "word " * 200
    cut = excerpt(text, "serpent", limit=120)
    assert "serpent" in cut and len(cut) <= 125


@pytest.mark.skipif(not (DELIVERED / "atlas.parquet").is_file(), reason="atlas not exported")
def test_delivered_atlas_has_every_column_and_no_embeddings():
    table = pq.read_table(DELIVERED / "atlas.parquet")
    assert table.column_names == ATLAS_COLUMNS
    assert not any("embedding" in name for name in table.column_names)
    summary = json.loads((DELIVERED / "summary.json").read_text(encoding="utf-8"))
    assert summary["point_count"] == table.num_rows
    assert set(table.column("symbol_id").to_pylist()) <= {s["id"] for s in summary["symbols"]}
