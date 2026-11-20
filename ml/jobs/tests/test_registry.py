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


def cached_run(tmp_path, monkeypatch, inputs):
    """A local run whose ad job-0 has two cached text versions: 'old' and the fitted 'new'."""
    import pandas as pd
    monkeypatch.setattr(registry, "CACHE", tmp_path)
    monkeypatch.setattr(registry, "ARTEFACTS", tmp_path / "artefacts")
    monkeypatch.setattr(registry, "run_config", lambda run_id: {"model": "m", "revision": "r"})
    run = tmp_path / "runs" / "run"
    run.mkdir(parents=True)
    pd.DataFrame({"job_id": ["job-0", "job-1"], "cluster_id": [0, 1]}).to_parquet(run / "assignments.parquet")
    if inputs:
        pd.DataFrame({"job_id": ["job-0", "job-1"], "text_hash": ["new", "one"]}).to_parquet(run / "inputs.parquet")
    pd.DataFrame({"job_id": ["job-0", "job-1", "job-0"], "text_hash": ["old", "one", "new"],
                  "embedding": [[1.0, 0.0], [0.0, 1.0], [0.6, 0.8]]}).to_parquet(registry.cache_path("m", "r"))


def test_reference_takes_the_text_version_the_run_was_fitted_on(tmp_path, monkeypatch):
    cached_run(tmp_path, monkeypatch, inputs=True)
    ids, vectors, labels = registry.reference("run")
    assert sorted(ids) == ["job-0", "job-1"]
    assert vectors[ids.index("job-0")].tolist() == pytest.approx([0.6, 0.8])


def test_reference_without_inputs_leaves_out_ambiguous_ads(tmp_path, monkeypatch):
    cached_run(tmp_path, monkeypatch, inputs=False)
    ids, _, labels = registry.reference("run")
    assert ids == ["job-1"] and labels.tolist() == [1]


def test_gate_fails_when_no_reference_ad_is_held_out(models, monkeypatch):
    ids = [f"job-{i}" for i in range(120)]
    held = [i for i in ids if int(registry.hashlib.sha256(i.encode()).hexdigest(), 16) % 10 < 3]
    rest = [i for i in ids if i not in held]
    vectors, labels = np.eye(3, dtype="float32")[np.zeros(len(rest), int)], -np.ones(len(rest), int)
    monkeypatch.setattr(registry, "reference", lambda run_id: (rest, vectors, labels))
    assert not registry.evaluate("noise-only")["passed"]
    monkeypatch.setattr(registry, "reference", lambda run_id: (ids, np.eye(3, dtype="float32")[np.zeros(120, int)],
                                                               -np.ones(120, int)))
    assert registry.evaluate("noise-only")["reasons"] == ["no cluster: every reference ad is noise"]
