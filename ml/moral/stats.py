"""Agreement statistics and nulls for docs/philosophy-moral-preregistration.md, numpy only."""
from __future__ import annotations

import hashlib

import numpy as np

SEED = 20261022


def rank(*parts) -> int:
    """The pre-registered draw order: SHA-1 of seed:parts, as an integer."""
    return int(hashlib.sha1(":".join(map(str, (SEED, *parts))).encode()).hexdigest()[:15], 16)


def f1(truth, pred) -> float | None:
    truth, pred = np.asarray(truth, bool), np.asarray(pred, bool)
    tp, fp, fn = (truth & pred).sum(), (~truth & pred).sum(), (truth & ~pred).sum()
    return None if tp + fp + fn == 0 else float(2 * tp / (2 * tp + fp + fn))


def kappa(a, b) -> float:
    """Cohen's kappa of two label vectors (any hashable labels)."""
    a, b = np.asarray(a), np.asarray(b)
    observed = float((a == b).mean())
    labels = np.union1d(a, b)
    expected = float(sum((a == x).mean() * (b == x).mean() for x in labels))
    return 0.0 if expected == 1 else (observed - expected) / (1 - expected)


def alpha_binary(units: list[list[int]]) -> float | None:
    """Krippendorff's alpha, nominal, for 0/1 codes; each unit lists the codes it received."""
    pairable = [u for u in units if len(u) >= 2]
    n = sum(len(u) for u in pairable)
    if n < 2:
        return None
    ones = sum(sum(u) for u in pairable)
    # Observed disagreement: pairs of different codes within a unit, weighted 1 / (m - 1).
    d_o = sum(2 * sum(u) * (len(u) - sum(u)) / (len(u) - 1) for u in pairable) / n
    d_e = 2 * ones * (n - ones) / (n * (n - 1))
    return None if d_e == 0 else 1 - d_o / d_e


def bootstrap(values, statistic, rounds: int = 1000, seed: int = SEED, groups=None) -> tuple[float, float]:
    """95 % percentile interval of statistic over resamples of the rows of values; with `groups`, whole
    groups are resampled (rows that share a scenario move together)."""
    values = np.asarray(values)
    rng = np.random.default_rng(seed)
    clusters = [np.flatnonzero(np.asarray(groups) == g) for g in dict.fromkeys(groups)] if groups is not None         else [np.array([i]) for i in range(len(values))]
    draws = [statistic(values[np.concatenate([clusters[i] for i in rng.integers(0, len(clusters), len(clusters))])])
             for _ in range(rounds)]
    low, high = np.nanpercentile(np.asarray(draws, float), [2.5, 97.5])
    return float(low), float(high)


def label_shuffle_null(truth, pred, rounds: int = 999, seed: int = SEED) -> dict:
    """Kappa when the human labels are permuted: 95th percentile and the one-sided p of the observed kappa."""
    truth, pred = np.asarray(truth), np.asarray(pred)
    rng = np.random.default_rng(seed)
    observed = kappa(truth, pred)
    null = np.array([kappa(rng.permutation(truth), pred) for _ in range(rounds)])
    return {"rounds": rounds, "kappa_p95": float(np.percentile(null, 95)),
            "p": float((1 + (null >= observed).sum()) / (rounds + 1))}


def party_spread(flags, years, parties) -> float:
    """Passage-weighted variance of party shares around each year's share, summed over years."""
    flags, years, parties = np.asarray(flags, float), np.asarray(years), np.asarray(parties)
    total = 0.0
    for y in np.unique(years):
        in_year = years == y
        year_share = flags[in_year].mean()
        for p in np.unique(parties[in_year]):
            cell = flags[in_year & (parties == p)]
            total += len(cell) * (cell.mean() - year_share) ** 2
    return total / len(flags)


def party_null(flags, years, parties, rounds: int = 999, seed: int = SEED) -> dict:
    """Party labels shuffled within year: the spread's null, its p, and each cell's 2.5-97.5 % band."""
    flags, years, parties = np.asarray(flags, float), np.asarray(years), np.asarray(parties)
    rng = np.random.default_rng(seed)
    observed = party_spread(flags, years, parties)
    groups = [np.flatnonzero(years == y) for y in np.unique(years)]
    cells: dict[tuple, list[float]] = {}
    spreads = []
    for _ in range(rounds):
        shuffled = parties.copy()
        for idx in groups:
            shuffled[idx] = rng.permutation(parties[idx])
        spreads.append(party_spread(flags, years, shuffled))
        for y, idx in zip(np.unique(years), groups):
            for p in np.unique(shuffled[idx]):
                cells.setdefault((y.item(), p), []).append(float(flags[idx][shuffled[idx] == p].mean()))
    spreads = np.asarray(spreads)
    return {"rounds": rounds, "spread": observed, "spread_p95": float(np.percentile(spreads, 95)),
            "p": float((1 + (spreads >= observed).sum()) / (rounds + 1)),
            "cells": {k: (float(np.percentile(v, 2.5)), float(np.percentile(v, 97.5))) for k, v in cells.items()}}


def holm(pvalues: list[float]) -> list[float]:
    order = np.argsort(pvalues)
    adjusted, running = [0.0] * len(pvalues), 0.0
    for i, j in enumerate(order):
        running = max(running, min(1.0, (len(pvalues) - i) * pvalues[j]))
        adjusted[j] = running
    return adjusted
