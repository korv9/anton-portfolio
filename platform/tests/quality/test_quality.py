"""The quality and validity layer: vocabulary, registry validation, status rules, the honest
handling of not_measured and not_applicable, and that Symbolic Atlas diagnostics are read from
the experiment artefacts for the right experiment."""
import json
import sys
from pathlib import Path

import pytest
import yaml

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "platform"))

from quality import evaluate, measures, registry, requirements, validity  # noqa: E402
from quality.dimensions import DIMENSIONS, STATUSES, VALIDITY_KINDS, VALIDITY_STATUSES  # noqa: E402


def test_dimensions_are_iso_25012_characteristics_and_validity_is_not_one():
    assert {"accuracy", "completeness", "consistency", "credibility", "currentness"} <= set(DIMENSIONS)
    for d in DIMENSIONS.values():
        assert d["question_en"] and d["iso_25012"]
    assert not set(VALIDITY_KINDS) & set(DIMENSIONS)
    assert set(STATUSES) == {"pass", "warning", "fail", "not_measured", "not_applicable"}
    assert "true" not in VALIDITY_STATUSES and "proven" not in VALIDITY_STATUSES


def test_the_registries_load_and_reference_known_products():
    quality, validity_registry = registry.load()
    assert len(quality["checks"]) >= 30
    products = set(quality["products"])
    assert {c["product"] for c in quality["checks"]} <= products
    assert {a["product"] for a in validity_registry["analyses"]} <= products
    # every product declares at least one check
    for p in products:
        assert any(c["product"] == p for c in quality["checks"]), p


def _write(tmp_path, data, name="r.yml"):
    path = tmp_path / name
    path.write_text(yaml.safe_dump(data), encoding="utf-8")
    return path


def _minimal_check(**changes):
    check = {"id": "a", "product": "p", "dataset": "d", "dimension": "accuracy", "description": "x",
             "method": "not_measured", "reason": "not yet", "severity": "warning", "source": "s"}
    check.update(changes)
    return check


def test_duplicate_ids_unknown_dimensions_and_missing_reasons_are_refused(tmp_path):
    products = [{"id": "p", "project": "p", "label_en": "P", "label_sv": "P"}]
    dup = _write(tmp_path, {"products": products, "checks": [_minimal_check(), _minimal_check()]})
    with pytest.raises(registry.RegistryError, match="duplicate"):
        registry.load_quality(dup)
    bad_dim = _write(tmp_path, {"products": products, "checks": [_minimal_check(dimension="validity")]})
    with pytest.raises(registry.RegistryError, match="ISO/IEC 25012"):
        registry.load_quality(bad_dim)
    no_reason = _write(tmp_path, {"products": products, "checks": [_minimal_check(reason=None)]})
    with pytest.raises(registry.RegistryError, match="why"):
        registry.load_quality(no_reason)
    unknown_product = _write(tmp_path, {"products": products, "checks": [_minimal_check(product="q")]})
    with pytest.raises(registry.RegistryError, match="unknown product"):
        registry.load_quality(unknown_product)


def test_thresholds():
    assert requirements.status_for(1.0, 1.0) == "pass"
    assert requirements.status_for(0.95, 1.0, warn_at=0.9) == "warning"
    assert requirements.status_for(0.85, 1.0, warn_at=0.9) == "fail"
    assert requirements.status_for(0.95, 1.0) == "fail"
    assert requirements.status_for(10, 14, "<=", 60) == "pass"
    assert requirements.status_for(30, 14, "<=", 60) == "warning"
    assert requirements.status_for(90, 14, "<=", 60) == "fail"
    assert requirements.status_for(None, 1.0) == "not_measured"
    assert requirements.sample_based(94, 100) == 0.94


def test_not_measured_and_not_applicable_never_become_pass():
    products = {"p": {"project": "p"}}
    na = evaluate.evaluate_check(_minimal_check(method="not_applicable", reason="historical"), products, None, None)
    nm = evaluate.evaluate_check(_minimal_check(), products, None, None)
    review = evaluate.evaluate_check(_minimal_check(method="manual_review", threshold=0.9, measure="m"), products, None, None)
    dbt = evaluate.evaluate_check(_minimal_check(method="dbt_test", threshold=1.0, measure="m", dbt={"names": ["x"]}),
                                  products, None, None)
    assert na["status"] == "not_applicable" and na["value"] is None
    assert nm["status"] == "not_measured" and nm["value"] is None
    assert review["status"] == "not_measured" and review["details"]["sample_based"]
    assert dbt["status"] == "not_measured"


def test_a_recorded_manual_review_is_sample_based():
    products = {"p": {"project": "p"}}
    check = _minimal_check(method="manual_review", threshold=0.9, measure="sample_accuracy",
                           review={"sample_size": 100, "valid": 94, "reviewed_at": "2026-10-06",
                                   "reviewer_role": "editor"})
    row = evaluate.evaluate_check(check, products, None, None)
    assert (row["value"], row["sample_size"], row["status"]) == (0.94, 100, "pass")
    assert row["details"]["sample_based"] is True


def test_dbt_checks_count_only_tests_that_ran():
    manifest = {"nodes": {
        "test.x.t1": {"name": "t1", "resource_type": "test", "depends_on": {"nodes": []}},
        "test.x.t2": {"name": "t2", "resource_type": "test", "depends_on": {"nodes": []}},
    }}
    products = {"p": {"project": "p"}}
    check = _minimal_check(method="dbt_test", threshold=1.0, measure="m", dbt={"names": ["t1", "t2"]})
    row = evaluate.evaluate_check(check, products, manifest, {"t1": "pass", "t2": "error"})
    assert (row["value"], row["denominator"], row["status"]) == (1.0, 1, "pass")
    assert row["details"]["not_run"] == ["t2"]
    none_ran = evaluate.evaluate_check(check, products, manifest, {"t1": "skipped", "t2": "error"})
    assert none_ran["status"] == "not_measured"
    failed = evaluate.evaluate_check(check, products, manifest, {"t1": "pass", "t2": "fail"})
    assert failed["status"] == "fail" and failed["details"]["failed"] == ["t2"]


def test_validity_rules_and_weakest_status():
    assert validity.status_for(0.69, {"metric_below": 0.5, "then": "supported", "otherwise": "warning"}) == "warning"
    assert validity.status_for(0.3, {"metric_below": 0.5, "then": "supported", "otherwise": "warning"}) == "supported"
    assert validity.status_for(None, {"metric_above": 0, "then": "supported", "otherwise": "warning"}) == "not_evaluated"
    assert validity.status_for(None, None, "insufficient_evidence") == "insufficient_evidence"
    assert validity.weakest(["supported", "warning", "insufficient_evidence"]) == "warning"


def test_symbolic_diagnostics_read_the_right_experiment(tmp_path, monkeypatch):
    folder = tmp_path / "symbolic/experiments"
    folder.mkdir(parents=True)
    comparison = {"sample_sha256": "abc", "experiments": [
        {"experiment": "baseline", "occurrences": 10, "clusters": 3, "mean_largest_book_share": 0.7,
         "cross_book_occurrence_share": 0.1, "mean_book_entropy": 0.3},
        {"experiment": "book_centered", "occurrences": 10, "clusters": 4, "mean_largest_book_share": 0.55,
         "cross_book_occurrence_share": 0.4, "mean_book_entropy": 0.5},
    ]}
    (folder / "comparison.json").write_text(json.dumps(comparison))
    monkeypatch.setattr(measures, "FEATURES", tmp_path)
    assert measures.symbolic_experiment_metric("baseline", "mean_largest_book_share").value == 0.7
    assert measures.symbolic_experiment_metric("book_centered", "mean_largest_book_share").value == 0.55
    assert measures.symbolic_experiment_metric("masked", "mean_largest_book_share") is None
    change = measures.symbolic_experiment_change("mean_book_entropy", "baseline", "book_centered")
    assert change.value == 0.2 and change.details["baseline"] == 0.3


def test_symbolic_diagnostics_match_the_current_artefact():
    path = ROOT / "warehouse/features/symbolic/experiments/comparison.json"
    if not path.is_file():
        pytest.skip("no Symbolic Atlas experiments in this checkout")
    rows = {e["experiment"]: e for e in json.loads(path.read_text())["experiments"]}
    for experiment in ("baseline", "book_centered"):
        for metric in ("mean_largest_book_share", "cross_book_occurrence_share"):
            assert measures.symbolic_experiment_metric(experiment, metric).value == rows[experiment][metric]


def test_published_quality_has_no_single_score_and_keeps_failures():
    folder = ROOT / "frontend/public/data/quality"
    if not (folder / "checks.json").is_file():
        pytest.skip("quality not published")
    text = (folder / "summary.json").read_text()
    assert "quality_score" not in text and '"score"' not in text
    checks = json.loads((folder / "checks.json").read_text())
    quality, _ = registry.load()
    assert {c["quality_check_id"] for c in checks} == {c["id"] for c in quality["checks"]}
    assert "certif" not in json.loads(text)["standards"]["claim"].replace("not a certification", "")
