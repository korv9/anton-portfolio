"""Grouped and temporal splits, and the assertions that prove they held.

Every split here keeps a group whole. Political speech and job advertisements both repeat
near-identical text within a group — the same debate, the same employer — so a random split
measures memorisation and reports it as skill. The assertions are not decoration: they run
on every split and raise, because a leak that is merely logged gets ignored.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np


@dataclass(frozen=True)
class Split:
    train: np.ndarray
    test: np.ndarray
    kind: str
    group_field: str

    def __post_init__(self):
        if len(set(self.train.tolist()) & set(self.test.tolist())):
            raise AssertionError("Split shares row indices between train and test")


def assert_no_group_leak(groups: np.ndarray, split: Split) -> None:
    """No group may appear on both sides. This is the whole point of a grouped split."""
    shared = set(groups[split.train].tolist()) & set(groups[split.test].tolist())
    if shared:
        raise AssertionError(
            f"{len(shared)} group(s) appear in both folds on field '{split.group_field}', "
            f"for example {sorted(shared)[:3]}"
        )


def grouped_split(groups: np.ndarray, test_size: float = 0.25, seed: int = 0) -> Split:
    """Hold out whole groups, sized by rows rather than by group count.

    Groups differ enormously in size — one debate has eight speeches, another eighty — so
    drawing a fixed fraction of groups gives an unpredictable fraction of rows.
    """
    rng = np.random.default_rng(seed)
    unique = np.unique(groups)
    rng.shuffle(unique)
    counts = {group: int((groups == group).sum()) for group in unique}
    target = test_size * len(groups)
    held, total = set(), 0
    for group in unique:
        if total >= target:
            break
        held.add(group)
        total += counts[group]
    mask = np.isin(groups, list(held))
    split = Split(np.where(~mask)[0], np.where(mask)[0], "grouped", "group")
    assert_no_group_leak(groups, split)
    return split


def temporal_split(order: np.ndarray, holdout_value) -> Split:
    """Train on everything before a cut, test on the cut itself.

    A grouped split still lets the model see the future. Where a claim is about applying a
    model forward in time, the holdout has to be later, not merely disjoint.
    """
    mask = order == holdout_value
    if not mask.any():
        raise ValueError(f"Temporal holdout {holdout_value!r} matches no rows")
    if mask.all():
        raise ValueError(f"Temporal holdout {holdout_value!r} matches every row")
    return Split(np.where(~mask)[0], np.where(mask)[0], "temporal", "order")


def grouped_folds(groups: np.ndarray, folds: int = 5, seed: int = 0):
    """Cross-validation that keeps groups whole, balancing folds by row count."""
    rng = np.random.default_rng(seed)
    unique = np.unique(groups)
    rng.shuffle(unique)
    sizes = {group: int((groups == group).sum()) for group in unique}
    buckets: list[list] = [[] for _ in range(folds)]
    loads = [0] * folds
    for group in sorted(unique, key=lambda g: -sizes[g]):
        target = int(np.argmin(loads))
        buckets[target].append(group)
        loads[target] += sizes[group]
    for bucket in buckets:
        mask = np.isin(groups, bucket)
        split = Split(np.where(~mask)[0], np.where(mask)[0], "grouped-cv", "group")
        assert_no_group_leak(groups, split)
        yield split
