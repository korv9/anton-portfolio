"""Incremental assignment: only new or changed texts are embedded, and the signals follow the store."""
import json

import numpy as np

from ml.jobs import assign, registry


def write(store, *rows):
    (store / "ads.json").write_text(json.dumps(list(rows)), encoding="utf-8")


def row(id, text, removed_at=None):
    return {"id": id, "headline": "Data Engineer", "description": text, "must_have": [], "nice_to_have": [],
            "content_hash": str(hash(text)), "removed_at": removed_at}


def test_only_new_or_changed_texts_are_embedded_and_signals_follow(tmp_path, monkeypatch):
    monkeypatch.setattr(registry, "current", lambda: {"run_id": "r1", "model": "m", "revision": None})
    ref = np.eye(4, dtype="float32")
    monkeypatch.setattr(registry, "reference", lambda run_id: (["a", "b", "c", "d"], ref, np.asarray([0, 0, 1, 1])))
    embedded = []

    def embed(jobs, directory, model, revision):
        embedded.append(sorted(jobs.job_id))
        vectors = np.asarray([ref[0] if "Python" in t else ref[2] for t in jobs.text], dtype="float32")
        return vectors, {"new_unique_texts": len(jobs), "reused": 0}

    write(tmp_path, row("1", "Krav: Python."), row("2", "Krav: Java."))
    first = assign.update(tmp_path, embed)
    assert embedded == [["1", "2"]] and first["signals"] == {"0": {"open": 1, "new": 1, "changed": 0, "removed": 0},
                                                            "1": {"open": 1, "new": 1, "changed": 0, "removed": 0}}
    assert assign.update(tmp_path, embed)["assigned"] == 0 and len(embedded) == 1
    write(tmp_path, row("1", "Krav: Python.", removed_at="2026-10-23T10:00:00"), row("2", "Krav: Python och SQL."))
    third = assign.update(tmp_path, embed)
    assert embedded[-1] == ["2"] and third["signals"]["0"] == {"open": 1, "new": 0, "changed": 1, "removed": 1}
