"""Run the quality and validity layer and write its results in one schema.

    python platform/quality/evaluate.py                     # run the registered dbt tests, then everything else
    python platform/quality/evaluate.py --dbt-results PATH  # reuse a dbt run_results.json instead of running dbt
    python platform/quality/evaluate.py --no-dbt            # dbt checks become not_measured
    python platform/quality/evaluate.py --gate              # exit 1 if a gated (structural) check fails

1. Loads and validates the registries (registry.py).
2. dbt checks: resolves each check's tests from the dbt manifest (by name, or by folder and test
   kind), runs only those tests (`dbt test --select ...`) and reads run_results.json. A test
   that errored or was skipped (its model not built, say) did not measure anything: a check
   whose tests all failed to run is not_measured.
3. Python checks: calls the function in measures.py. None means not_measured.
4. Manual reviews: a recorded review (sample size, valid count) gives a sample-based value;
   without one the check is not_measured.
5. Validity: computes each diagnostic from its artefact (measures.py) and applies its rule.
   Nothing is retrained or re-embedded.

Writes warehouse/features/quality/: quality_checks.parquet, analysis_validity.parquet,
validity_history.parquet, confounders.parquet, run.json, and appends to history.jsonl so
status changes between runs can be followed. dbt reads the Parquet files back.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "platform"))

from quality import measures, registry, requirements, validity  # noqa: E402
from quality.dimensions import DIMENSIONS  # noqa: E402

PLATFORM = ROOT / "platform"
OUT = Path(os.environ.get("PORTFOLIO_FEATURES", ROOT / "warehouse/features")) / "quality"
TARGET = "target/quality"


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


# ---------------------------------------------------------------- dbt

def test_kind(node: dict) -> str:
    meta = node.get("test_metadata")
    return meta["name"] if meta else "singular"


def model_folder(manifest: dict, node: dict) -> str | None:
    for dep in node["depends_on"]["nodes"]:
        target = manifest["nodes"].get(dep)
        if target and target["resource_type"] in ("model", "seed"):
            fqn = target["fqn"]
            return fqn[2] if target["resource_type"] == "model" and len(fqn) > 3 else fqn[1]
    return None


def resolve_tests(manifest: dict, spec: dict) -> list[str]:
    """The dbt test names a check stands on, from explicit names or a folder and test kinds."""
    tests = {n["name"]: n for n in manifest["nodes"].values() if n["resource_type"] == "test"}
    if spec.get("names"):
        return [name for name in spec["names"] if name in tests]
    kinds = set(spec.get("kinds", []))
    return sorted(name for name, node in tests.items()
                  if model_folder(manifest, node) == spec["folder"] and (not kinds or test_kind(node) in kinds))


def run_dbt(names: list[str]) -> dict:
    cmd = [sys.executable, "-m", "dbt.cli.main", "test", "--profiles-dir", ".", "--target-path", TARGET,
           "--select", *names]
    print(f"dbt test on {len(names)} tests …", flush=True)
    subprocess.run(cmd, cwd=PLATFORM, check=False, capture_output=True, text=True)
    return json.loads((PLATFORM / TARGET / "run_results.json").read_text(encoding="utf-8"))


def parse_manifest() -> dict:
    subprocess.run([sys.executable, "-m", "dbt.cli.main", "parse", "--profiles-dir", ".", "--target-path", TARGET],
                   cwd=PLATFORM, check=True, capture_output=True, text=True)
    return json.loads((PLATFORM / TARGET / "manifest.json").read_text(encoding="utf-8"))


def dbt_outcomes(results: dict) -> dict[str, str]:
    """Test name -> pass | fail | warn | error | skipped."""
    out = {}
    for r in results.get("results", []):
        name = r["unique_id"].split(".")[2]
        out[name] = r["status"]
    return out


# ---------------------------------------------------------------- checks

def base_row(check: dict, products: dict) -> dict:
    return {
        "quality_check_id": check["id"],
        "product_id": check["product"],
        "project_id": products[check["product"]]["project"],
        "dataset_id": check["dataset"],
        "dimension": check["dimension"],
        "dimension_label": DIMENSIONS[check["dimension"]]["label_en"],
        "description": check["description"],
        "measure_name": check.get("measure"),
        "numerator_definition": check.get("numerator"),
        "denominator_definition": check.get("denominator"),
        "comparator": check.get("comparator", ">=") if "threshold" in check else None,
        "threshold": check.get("threshold"),
        "warn_at": check.get("warn_at"),
        "severity": check["severity"],
        "method": check["method"],
        "source": check["source"],
        "gate": bool(check.get("gate", False)),
        "value": None, "numerator": None, "denominator": None,
        "sample_size": None, "reviewed_at": None,
        "status": "not_measured",
        "details": {},
    }


def evaluate_check(check: dict, products: dict, manifest: dict | None, outcomes: dict | None) -> dict:
    row = base_row(check, products)
    method = check["method"]
    if method == "not_applicable":
        row.update(status="not_applicable", details={"reason": check["reason"]})
    elif method == "not_measured":
        row["details"] = {"reason": check["reason"]}
    elif method == "manual_review":
        review = check.get("review")
        if review:
            value = requirements.sample_based(review["valid"], review["sample_size"])
            row.update(value=value, numerator=review["valid"], denominator=review["sample_size"],
                       sample_size=review["sample_size"], reviewed_at=review.get("reviewed_at"),
                       details={"sample_based": True, "notes": review.get("notes"),
                                "reviewer_role": review.get("reviewer_role")})
            row["status"] = requirements.status_for(value, check["threshold"], check.get("comparator", ">="),
                                                    check.get("warn_at"))
        else:
            row["details"] = {"reason": check["reason"], "sample_based": True}
    elif method == "python":
        try:
            m = getattr(measures, check["function"])()
        except Exception as error:  # a broken input is reported, not hidden
            m, row["details"] = None, {"error": f"{type(error).__name__}: {error}"}
        if m is not None:
            row.update(value=m.value, numerator=m.numerator, denominator=m.denominator, details=m.details)
            row["status"] = requirements.status_for(m.value, check["threshold"], check.get("comparator", ">="),
                                                    check.get("warn_at"))
        elif not row["details"]:
            row["details"] = {"reason": "the input this check reads does not exist yet"}
    elif method == "dbt_test":
        if manifest is None or outcomes is None:
            row["details"] = {"reason": "dbt results not collected in this run"}
        else:
            names = resolve_tests(manifest, check["dbt"])
            ran = {n: outcomes.get(n) for n in names}
            measured = {n: s for n, s in ran.items() if s in ("pass", "fail", "warn")}
            not_run = sorted(n for n in names if n not in measured)
            failed = sorted(n for n, s in measured.items() if s != "pass")
            row["details"] = {"tests": len(names), "not_run": not_run, "failed": failed}
            if measured:
                passed = sum(1 for s in measured.values() if s == "pass")
                row.update(value=passed / len(measured), numerator=passed, denominator=len(measured))
                row["status"] = requirements.status_for(row["value"], check["threshold"],
                                                        check.get("comparator", ">="), check.get("warn_at"))
            else:
                row["details"]["reason"] = "no test in this check could run (models not built)"
    return row


# ---------------------------------------------------------------- validity

def evaluate_validity(validity_registry: dict, evaluated_at: str) -> tuple[list[dict], list[dict]]:
    rows, history = [], []
    for analysis_order, a in enumerate(validity_registry["analyses"]):
        statuses = []
        for diagnostic_order, d in enumerate(a["diagnostics"]):
            value, details = None, {}
            if d.get("function"):
                try:
                    diag = getattr(measures, d["function"])(**d.get("args", {}))
                except Exception as error:
                    diag, details = None, {"error": f"{type(error).__name__}: {error}"}
                if diag is not None:
                    value, details = diag.value, diag.details
            status = validity.status_for(value, d.get("rule"), d.get("status"))
            if d.get("function") and value is None and d.get("rule") is None:
                status = d.get("status", "not_evaluated")
            statuses.append(status)
            rows.append({
                "analysis_id": a["id"], "product_id": a["product"], "kind": a["kind"],
                "analysis_order": analysis_order, "diagnostic_order": diagnostic_order,
                "question_en": a["question_en"], "question_sv": a.get("question_sv"),
                "target_construct": a["target_construct"], "proxy_measure": a["proxy_measure"],
                "diagnostic_id": d["id"], "diagnostic": d.get("label_en", d["id"]),
                "experiment": d.get("experiment"),
                "result": value, "details": details,
                "rule": d.get("rule"),
                "interpretation": d["interpretation_en"],
                "status": status, "source": a.get("source"),
                "conclusion_en": a["conclusion_en"], "conclusion_sv": a.get("conclusion_sv"),
                "evaluated_at": evaluated_at,
            })
        for r in rows:
            if r["analysis_id"] == a["id"]:
                r["analysis_status"] = validity.weakest(statuses)
        if a.get("history"):
            for h in getattr(measures, a["history"]["function"])():
                history.append({"analysis_id": a["id"], "product_id": a["product"], **h})
    return rows, history


# ---------------------------------------------------------------- main

def to_frame(rows: list[dict], json_columns: tuple[str, ...]) -> pd.DataFrame:
    frame = pd.DataFrame(rows)
    for column in json_columns:
        if column in frame:
            frame[column] = frame[column].map(lambda v: json.dumps(v, ensure_ascii=False, default=str))
    return frame


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--dbt-results", type=Path, help="Reuse this run_results.json")
    parser.add_argument("--no-dbt", action="store_true")
    parser.add_argument("--gate", action="store_true", help="Exit 1 if a gated check fails")
    args = parser.parse_args()

    quality, validity_registry = registry.load()
    evaluated_at = now()
    manifest = outcomes = None
    if not args.no_dbt:
        manifest = parse_manifest()
        names = sorted({n for c in quality["checks"] if c["method"] == "dbt_test"
                        for n in resolve_tests(manifest, c["dbt"])})
        results = (json.loads(args.dbt_results.read_text(encoding="utf-8")) if args.dbt_results
                   else run_dbt(names))
        outcomes = dbt_outcomes(results)

    checks = [evaluate_check(c, quality["products"], manifest, outcomes) for c in quality["checks"]]
    for c in checks:
        c["evaluated_at"] = evaluated_at
    analyses, history = evaluate_validity(validity_registry, evaluated_at)
    confounders = validity_registry["confounders"]

    OUT.mkdir(parents=True, exist_ok=True)
    to_frame(checks, ("details",)).to_parquet(OUT / "quality_checks.parquet", index=False)
    to_frame(analyses, ("details", "rule")).to_parquet(OUT / "analysis_validity.parquet", index=False)
    pd.DataFrame(history or [{"analysis_id": None, "product_id": None, "run_label": None, "experiment": None,
                              "metric": None, "value": None}]).dropna(how="all").to_parquet(
        OUT / "validity_history.parquet", index=False)
    pd.DataFrame(confounders).to_parquet(OUT / "confounders.parquet", index=False)
    pd.DataFrame([{"product_id": p["id"], "project_id": p["project"], "label_en": p["label_en"],
                   "label_sv": p["label_sv"]} for p in quality["products"].values()]).to_parquet(
        OUT / "products.parquet", index=False)

    registry_hash = hashlib.sha256((registry.QUALITY.read_bytes() + registry.VALIDITY.read_bytes())).hexdigest()
    counts = pd.Series([c["status"] for c in checks]).value_counts().to_dict()
    vcounts = pd.Series([a["status"] for a in analyses]).value_counts().to_dict()
    run = {"evaluated_at": evaluated_at, "registry_sha256": registry_hash,
           "dbt": "skipped" if args.no_dbt else ("reused" if args.dbt_results else "ran"),
           "checks": len(checks), "check_statuses": counts,
           "analyses": len(validity_registry["analyses"]), "diagnostics": len(analyses),
           "diagnostic_statuses": vcounts}
    (OUT / "run.json").write_text(json.dumps(run, indent=1) + "\n", encoding="utf-8")
    with (OUT / "history.jsonl").open("a", encoding="utf-8") as log:
        for c in checks:
            log.write(json.dumps({"evaluated_at": evaluated_at, "quality_check_id": c["quality_check_id"],
                                  "status": c["status"], "value": c["value"]}) + "\n")
        for a in analyses:
            log.write(json.dumps({"evaluated_at": evaluated_at, "analysis_id": a["analysis_id"],
                                  "diagnostic_id": a["diagnostic_id"], "status": a["status"],
                                  "result": a["result"]}) + "\n")
    print(json.dumps(run, indent=1))

    gated = [c["quality_check_id"] for c in checks if c["gate"] and c["status"] == "fail"]
    if args.gate and gated:
        print(f"Gated checks failed: {', '.join(gated)}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
