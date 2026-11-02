"""The cluster model register: the gate refuses a weak model, promotion and rollback are explicit."""
import numpy as np
import pytest

from ml.jobs import registry


@pytest.fixture
def models(tmp_path, monkeypatch):
    monkeypatch.setattr(registry, "REGISTRY", tmp_path / "registry.json")
    monkeypatch.setattr(registry, "ARTEFACTS", tmp_path / "artefacts")
    monkeypatch.setattr(registry, "run_config", lambda run_id: {"model": "m", "revision": run_id})
    rng = np.random.default_rng(0)
    centres = np.eye(3, dtype="float32")
    labels = np.repeat([0, 1, 2], 40)
    good = centres[labels] + rng.normal(0, .05, (120, 3)).astype("float32")
    noise = rng.normal(0, 1, (120, 3)).astype("float32")
    runs = {"good": good, "other": good, "random": noise}
    ids = [f"job-{i}" for i in range(120)]
    monkeypatch.setattr(registry, "reference", lambda run_id: (ids, runs[run_id], labels))


def test_gate_promote_and_rollback(models):
    assert registry.evaluate("good")["passed"]
    with pytest.raises(SystemExit, match="not promoted"):
        registry.promote("random")
    registry.promote("good")
    registry.promote("other")
    assert registry.current()["run_id"] == "other"
    registry.rollback()
    assert registry.current() == {"run_id": "good", "model": "m", "revision": "good"}
    assert [h["action"] for h in registry.load()["history"]] == ["promote", "promote", "rollback"]
    assert registry.artefact("good").exists() and registry.artefact("other").exists()


def test_vote_takes_the_majority_and_breaks_ties_by_the_nearest():
    ref = np.asarray([[1, 0], [.9, .1], [0, 1], [.1, .9]], dtype="float32")
    cluster, support, nearest = registry.vote(np.asarray([[1, 0]], dtype="float32"), ref, np.asarray([0, 1, 1, 0]), k=2)
    assert cluster.tolist() == [0] and support.tolist() == [.5] and nearest[0] == pytest.approx(1)
