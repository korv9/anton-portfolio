"""Publish the quality and validity layer for the site.

    python platform/publish/quality/export_quality.py

Writes under frontend/public/data/quality/:

    summary.json    the dimensions (plain-language question, ISO/IEC 25012 mapping), the
                    validity kinds and statuses, the products, product × dimension counts,
                    product × validity-kind counts and the run (when, registry hash)
    checks.json     every check result: definition, measure, numerator and denominator,
                    threshold, value, status, severity, method, source, details
    validity.json   every analysis with its diagnostics (result, rule, status, interpretation),
                    conclusion, registered confounders and the recorded history

Failures and unmeasured checks are published like every other result. Nothing is filtered.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "platform"))

from quality.dimensions import DIMENSIONS, STATUSES, VALIDITY_KINDS, VALIDITY_STATUSES  # noqa: E402

DATABASE = Path(os.environ.get("PORTFOLIO_DB", ROOT / "warehouse/portfolio.duckdb"))
FEATURES = Path(os.environ.get("PORTFOLIO_FEATURES", ROOT / "warehouse/features")) / "quality"
OUT = ROOT / "frontend/public/data/quality"


def rows(con, sql: str) -> list[dict]:
    records = json.loads(con.sql(sql).df().to_json(orient="records", force_ascii=False, date_format="iso"))
    for r in records:
        for k, v in list(r.items()):
            if isinstance(v, float):
                r[k] = round(v, 6)
            if k in ("details", "rule") and isinstance(v, str):
                r[k] = json.loads(v)
    return records


def dump(name: str, payload) -> Path:
    path = OUT / name
    path.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    return path


def main() -> int:
    con = duckdb.connect(str(DATABASE), read_only=True)
    OUT.mkdir(parents=True, exist_ok=True)
    run = json.loads((FEATURES / "run.json").read_text(encoding="utf-8"))
    products = rows(con, "select * from gold.dim_quality_product")
    checks = rows(con, """select * exclude (content_type) from gold.mart_quality_checks
                          order by product_id, dimension, quality_check_id""")
    summary_rows = rows(con, "select * from gold.mart_product_quality_summary order by product_id, dimension")
    validity_summary = rows(con, "select * from gold.mart_product_validity_summary order by product_id, kind")
    diagnostics = rows(con, "select * from gold.mart_analysis_validity order by analysis_order, diagnostic_order")
    confounders = rows(con, "select * exclude (content_type) from gold.mart_analysis_confounders")
    history = rows(con, "select * from gold.mart_validity_history order by analysis_id, metric, experiment, run_label")

    analyses: dict[str, dict] = {}
    for d in diagnostics:
        a = analyses.setdefault(d["analysis_id"], {
            k: d[k] for k in ("analysis_id", "product_id", "kind", "question_en", "question_sv", "target_construct",
                              "proxy_measure", "analysis_status", "conclusion_en", "conclusion_sv", "source",
                              "evaluated_at")} | {"diagnostics": []})
        a["diagnostics"].append({k: d[k] for k in ("diagnostic_id", "diagnostic", "experiment", "result", "details",
                                                    "rule", "status", "interpretation")})
    for c in confounders:
        analyses.get(c["analysis"], {}).setdefault("confounders", []).append(c)
    for h in history:
        analyses.get(h["analysis_id"], {}).setdefault("history", []).append(
            {k: h[k] for k in ("run_label", "experiment", "metric", "value")})

    summary = {
        "dimensions": [{"id": k, **v} for k, v in DIMENSIONS.items()],
        "statuses": list(STATUSES),
        "validity_kinds": [{"id": k, **v} for k, v in VALIDITY_KINDS.items()],
        "validity_statuses": list(VALIDITY_STATUSES),
        "products": products,
        "product_dimensions": summary_rows,
        "product_validity": validity_summary,
        "run": run,
        "standards": {
            "iso_25012": "Selected checks are mapped to ISO/IEC 25012 data-quality characteristics.",
            "iso_25024": "Numeric measures state their calculation, numerator, denominator and threshold, aligned with ISO/IEC 25024 measurement principles where applicable.",
            "iso_5259": "ML and analytics data-quality considerations (split integrity, leakage, imbalance) may reference the ISO/IEC 5259 family.",
            "claim": "An internal engineering quality model mapped to these standards; not a certification and not an audit.",
        },
    }
    written = [dump("summary.json", summary), dump("checks.json", checks),
               dump("validity.json", list(analyses.values()))]
    sys.path.insert(0, str(ROOT / "platform/publish/symbolic"))
    import export_symbolic

    export_symbolic.register(written)
    print(f"Quality: {len(checks)} checks, {len(analyses)} analyses, {len(diagnostics)} diagnostics -> "
          f"{OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
