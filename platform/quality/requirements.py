"""Turning a measured value into a status, the same way for every check.

A value of None means nothing was measured: the status is not_measured, never pass. The
threshold is the pass level; `warn_at` (optional) is the edge between warning and fail.
"""
from __future__ import annotations


def status_for(value: float | None, threshold: float, comparator: str = ">=", warn_at: float | None = None) -> str:
    if value is None:
        return "not_measured"
    if comparator == "==":
        return "pass" if value == threshold else "fail"
    if comparator == ">=":
        if value >= threshold:
            return "pass"
        return "warning" if warn_at is not None and value >= warn_at else "fail"
    if comparator == "<=":
        if value <= threshold:
            return "pass"
        return "warning" if warn_at is not None and value <= warn_at else "fail"
    raise ValueError(f"unknown comparator {comparator}")


def sample_based(valid: int, sample_size: int) -> float | None:
    """Accuracy from a reviewed sample: the share judged valid. Labelled sample-based wherever shown."""
    return valid / sample_size if sample_size else None
