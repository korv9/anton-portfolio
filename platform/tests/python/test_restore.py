"""portfolio.publish.restore: the active releases, verified, into a local data root."""
import hashlib
import json

import pytest

from portfolio.publish import restore

RELEASE = "a" * 64


def entry(key, data):
    return {"key": key, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}


def bucket(files, group="baseline"):
    """A fake public bucket: current.json, one group manifest and its files."""
    objects = {f"releases/{group}/{RELEASE}/files/{p}": d for p, d in files.items()}
    manifest = json.dumps({"files": {p: entry(k, objects[k]) for p, k in
                                     ((p, f"releases/{group}/{RELEASE}/files/{p}") for p in files)}}).encode()
    key = f"releases/{group}/{RELEASE}/manifest.json"
    objects[key] = manifest
    objects["manifests/current.json"] = json.dumps({"schema_version": 2, "groups": {
        group: {**entry(key, manifest), "release": RELEASE}}}).encode()
    return objects


def test_restores_every_file_and_keeps_what_already_matches(tmp_path, monkeypatch):
    objects = bucket({"gold/a.json": b"[1]", "workers-ai/sfs/vectors.bin": b"\x01\x02"})
    monkeypatch.setattr(restore, "fetch", lambda key, fresh=False: objects[key])
    assert restore.restore(tmp_path) == {"files": 2, "written": 2, "kept": 0}
    assert (tmp_path / "workers-ai/sfs/vectors.bin").read_bytes() == b"\x01\x02"
    (tmp_path / "gold/a.json").write_bytes(b"[2]")  # a stale export is replaced
    assert restore.restore(tmp_path) == {"files": 2, "written": 1, "kept": 1}
    assert (tmp_path / "gold/a.json").read_bytes() == b"[1]"
    assert restore.restore(tmp_path, skip=["baseline"])["files"] == 0


def test_a_byte_that_differs_from_the_manifest_fails(tmp_path, monkeypatch):
    objects = bucket({"gold/a.json": b"[1]"})
    objects[f"releases/baseline/{RELEASE}/files/gold/a.json"] = b"[9]"
    monkeypatch.setattr(restore, "fetch", lambda key, fresh=False: objects[key])
    with pytest.raises(ValueError, match="gold/a.json differs"):
        restore.restore(tmp_path)
    assert not (tmp_path / "gold/a.json").exists()


def test_a_path_outside_the_root_is_refused(tmp_path, monkeypatch):
    objects = bucket({"../escape.json": b"[1]"})
    monkeypatch.setattr(restore, "fetch", lambda key, fresh=False: objects[key])
    with pytest.raises(ValueError, match="Invalid delivered path"):
        restore.restore(tmp_path)
