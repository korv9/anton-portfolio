"""Leak-free splits: parameter selection and final evaluation never share related texts.

Observations are related when they share a group (a work, book, employer or debate) or an
identical text. Related observations are merged into one component with union-find, and whole
components go to one side, so a duplicated ad or a reprinted passage cannot sit on both.
"""
from __future__ import annotations

import numpy as np


def components(groups, text_hashes) -> np.ndarray:
    """Component index per observation: shared group or shared text hash joins components."""
    groups, text_hashes = list(map(str, groups)), list(map(str, text_hashes))
    parent = list(range(len(groups)))

    def find(i: int) -> int:
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    for keys in (groups, text_hashes):
        first: dict[str, int] = {}
        for i, key in enumerate(keys):
            if key in first:
                a, b = find(i), find(first[key])
                if a != b:
                    parent[a] = b
            else:
                first[key] = i
    roots = [find(i) for i in range(len(groups))]
    _, index = np.unique(roots, return_inverse=True)
    return index


def split(groups, text_hashes, selection_share: float = 0.5, seed: int = 0) -> np.ndarray:
    """Boolean mask, True for the selection side. Whole components are assigned at random until
    the selection side holds about `selection_share` of the observations."""
    comp = components(groups, text_hashes)
    order = np.random.default_rng(seed).permutation(comp.max() + 1)
    sizes = np.bincount(comp)
    taken, chosen = 0, set()
    target = selection_share * len(comp)
    for c in order:
        if taken >= target:
            break
        chosen.add(int(c))
        taken += sizes[c]
    return np.isin(comp, list(chosen))


def check(mask: np.ndarray, groups, text_hashes) -> list[str]:
    """Leaks between the sides: groups or texts present on both."""
    groups, text_hashes = np.asarray(groups).astype(str), np.asarray(text_hashes).astype(str)
    problems = []
    for name, keys in (('group', groups), ('text', text_hashes)):
        both = set(keys[mask]) & set(keys[~mask])
        if both:
            problems.append(f'{len(both)} {name} keys on both sides')
    return problems
