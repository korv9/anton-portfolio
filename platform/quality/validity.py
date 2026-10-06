"""Analytical validity: a diagnostic's status from its rule, or as stated for qualitative findings.

Statuses are supported, warning, insufficient_evidence, invalidated and not_evaluated. A
diagnostic whose artefact does not exist yet is not_evaluated, whatever its rule says.
"""
from __future__ import annotations


def status_for(value: float | None, rule: dict | None, stated: str | None = None) -> str:
    if rule is None:
        return stated or "not_evaluated"
    if value is None:
        return "not_evaluated"
    if "metric_below" in rule:
        return rule["then"] if value < rule["metric_below"] else rule["otherwise"]
    return rule["then"] if value > rule["metric_above"] else rule["otherwise"]


# The order from most to least reassuring, for summarising an analysis by its weakest finding.
ORDER = ["invalidated", "warning", "insufficient_evidence", "not_evaluated", "supported"]


def weakest(statuses: list[str]) -> str:
    """An analysis is as strong as its weakest diagnostic."""
    return min(statuses, key=ORDER.index) if statuses else "not_evaluated"
