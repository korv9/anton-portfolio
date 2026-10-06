"""Load and validate the quality and validity registries.

A registry error is a programming error, not a data-quality result: unknown dimension, status,
method or product, a duplicate id, a python check without a function, a threshold without a
measure. `load()` raises RegistryError on any of them, and the tests run it.
"""
from __future__ import annotations

from pathlib import Path

import yaml

from . import measures
from .dimensions import COMPARATORS, DIMENSIONS, METHODS, SEVERITIES, VALIDITY_KINDS, VALIDITY_STATUSES

HERE = Path(__file__).resolve().parent
QUALITY = HERE / "quality_registry.yml"
VALIDITY = HERE / "validity_registry.yml"
RULE_KEYS = ({"metric_below", "then", "otherwise"}, {"metric_above", "then", "otherwise"})


class RegistryError(ValueError):
    pass


def _fail(message: str):
    raise RegistryError(message)


def load_quality(path: Path = QUALITY) -> dict:
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    products = {p["id"]: p for p in data["products"]}
    seen = set()
    for c in data["checks"]:
        cid = c.get("id") or _fail("a check has no id")
        if cid in seen:
            _fail(f"duplicate quality check id: {cid}")
        seen.add(cid)
        for key in ("product", "dataset", "dimension", "description", "method", "severity", "source"):
            if not c.get(key):
                _fail(f"{cid}: missing {key}")
        if c["product"] not in products:
            _fail(f"{cid}: unknown product {c['product']}")
        if c["dimension"] not in DIMENSIONS:
            _fail(f"{cid}: {c['dimension']} is not a modelled ISO/IEC 25012 dimension")
        if c["method"] not in METHODS:
            _fail(f"{cid}: unknown method {c['method']}")
        if c["severity"] not in SEVERITIES:
            _fail(f"{cid}: unknown severity {c['severity']}")
        if c.get("comparator", ">=") not in COMPARATORS:
            _fail(f"{cid}: unknown comparator {c['comparator']}")
        if c["method"] in ("dbt_test", "python", "manual_review") and "threshold" not in c:
            _fail(f"{cid}: a measured check needs a threshold")
        if "threshold" in c and not c.get("measure"):
            _fail(f"{cid}: a threshold needs a named measure")
        if c["method"] == "python" and not callable(getattr(measures, c.get("function", ""), None)):
            _fail(f"{cid}: no function {c.get('function')} in measures.py")
        if c["method"] == "dbt_test" and not (c.get("dbt", {}).get("names") or c.get("dbt", {}).get("folder")):
            _fail(f"{cid}: a dbt check names its tests or a folder")
        if c["method"] in ("not_measured", "not_applicable") and not c.get("reason"):
            _fail(f"{cid}: say why it is {c['method']}")
        if c["method"] == "manual_review" and not c.get("reason") and not c.get("review"):
            _fail(f"{cid}: a manual review has a review or says why it has none")
    return {"products": products, "checks": data["checks"]}


def load_validity(path: Path = VALIDITY, products: dict | None = None) -> dict:
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    seen = set()
    ids = {a["id"] for a in data["analyses"]}
    for a in data["analyses"]:
        aid = a.get("id") or _fail("an analysis has no id")
        if aid in seen:
            _fail(f"duplicate analysis id: {aid}")
        seen.add(aid)
        for key in ("product", "kind", "question_en", "target_construct", "proxy_measure", "diagnostics", "conclusion_en"):
            if not a.get(key):
                _fail(f"{aid}: missing {key}")
        if products is not None and a["product"] not in products:
            _fail(f"{aid}: unknown product {a['product']}")
        if a["kind"] not in VALIDITY_KINDS:
            _fail(f"{aid}: unknown validity kind {a['kind']}")
        if a["kind"] in DIMENSIONS:
            _fail(f"{aid}: validity is never an ISO/IEC 25012 dimension")
        dseen = set()
        for d in a["diagnostics"]:
            did = d.get("id") or _fail(f"{aid}: a diagnostic has no id")
            if did in dseen:
                _fail(f"{aid}: duplicate diagnostic {did}")
            dseen.add(did)
            if not d.get("interpretation_en"):
                _fail(f"{aid}.{did}: a diagnostic needs an interpretation")
            fn = d.get("function")
            if fn and not callable(getattr(measures, fn, None)):
                _fail(f"{aid}.{did}: no function {fn} in measures.py")
            rule = d.get("rule")
            if rule is not None:
                if set(rule) not in RULE_KEYS:
                    _fail(f"{aid}.{did}: a rule is metric_below or metric_above with then and otherwise")
                if rule["then"] not in VALIDITY_STATUSES or rule["otherwise"] not in VALIDITY_STATUSES:
                    _fail(f"{aid}.{did}: rule statuses must be validity statuses")
                if not fn:
                    _fail(f"{aid}.{did}: a rule needs a function that computes the metric")
            elif d.get("status") not in VALIDITY_STATUSES:
                _fail(f"{aid}.{did}: a qualitative diagnostic needs a validity status")
    for c in data.get("confounders", []):
        if c["analysis"] not in ids:
            _fail(f"confounder for unknown analysis {c['analysis']}")
        for key in ("confounder", "effect", "mitigation", "remaining_risk"):
            if not c.get(key):
                _fail(f"confounder {c['analysis']}/{c.get('confounder')}: missing {key}")
    return {"analyses": data["analyses"], "confounders": data.get("confounders", [])}


def load() -> tuple[dict, dict]:
    quality = load_quality()
    return quality, load_validity(products=quality["products"])
