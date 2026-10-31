"""Alignment, version 2: four candidates and the rule that picks one, fixed before the run.

Version 1 chose the alignment with the lowest corpus purity, which noise would also win. Two
checks guard against that here (see docs/cluster-atlas.md, "Version 2"):

  retention          does a passage's group (party, tradition, occupation) still win a vote of its
                     15 nearest passages from other units of its corpus? As a ratio to raw vectors
  translation match  measured on odd-numbered AI Act articles only, since the language directions
                     are estimated on the even-numbered ones

and one tie-break, the language gap: how far the share of cross-corpus neighbours in the same
language sits from the share a random neighbour would give.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from . import space

NEIGHBOURS = 15
SAMPLE = 2000
RETAIN = 0.90
TIE = 0.01
GROUPED = ('debates', 'symbols', 'jobs')
SEED = 0


def _article(frame: pd.DataFrame) -> pd.Series:
    """'sv:art_5:2' -> 5; recitals and annexes get -1 and fall in neither half."""
    number = frame.item_id.str.extract(r'^\w+:art_(\d+)', expand=False)
    return pd.to_numeric(number, errors='coerce').fillna(-1).astype(int)


def _pairs(frame: pd.DataFrame, odd: bool) -> tuple[np.ndarray, np.ndarray]:
    act = frame[frame.corpus == 'ai_act']
    number = _article(act)
    act = act[(number >= 0) & (number % 2 == int(odd))]
    key = act.item_id.str[3:]
    sv = act[act.language == 'sv'].assign(key=key).set_index('key')
    en = act[act.language == 'en'].assign(key=key).set_index('key')
    shared = sv.index.intersection(en.index)
    return sv.loc[shared, 'row'].to_numpy(), en.loc[shared, 'row'].to_numpy()


def language_directions(frame: pd.DataFrame, aligned: np.ndarray, count: int) -> np.ndarray:
    sv, en = _pairs(frame.assign(row=np.arange(len(frame))), odd=False)
    differences = aligned[sv] - aligned[en]
    differences -= differences.mean(axis=0)
    return np.linalg.svd(differences, full_matrices=False)[2][:count]


def remove(aligned: np.ndarray, directions: np.ndarray) -> np.ndarray:
    return space.normalise(aligned - (aligned @ directions.T) @ directions)


def translation_odd(frame: pd.DataFrame, aligned: np.ndarray) -> float:
    sv, en = _pairs(frame.assign(row=np.arange(len(frame))), odd=True)
    best = space.top_k(aligned[sv], aligned[en], 1)[:, 0]
    return round(float((best == np.arange(len(en))).mean()), 4)


def retention_accuracy(frame: pd.DataFrame, aligned: np.ndarray) -> dict[str, float]:
    """Share of sampled passages whose group wins the vote of neighbours from other units."""
    rng = np.random.default_rng(SEED)
    out = {}
    for corpus in GROUPED:
        rows = np.flatnonzero(frame.corpus.to_numpy() == corpus)
        if not len(rows):
            continue
        groups, units = frame.group.to_numpy()[rows], frame.unit.astype(str).to_numpy()[rows]
        picked = rng.choice(len(rows), size=min(SAMPLE, len(rows)), replace=False)
        sims = aligned[rows[picked]] @ aligned[rows].T
        sims[units[picked][:, None] == units[None, :]] = -np.inf
        nearest = np.argpartition(-sims, NEIGHBOURS, axis=1)[:, :NEIGHBOURS]
        votes = [pd.Series(groups[n]).value_counts().index[0] for n in nearest]
        out[corpus] = round(float((np.array(votes) == groups[picked]).mean()), 4)
    return out


def language_gap(frame: pd.DataFrame, aligned: np.ndarray) -> dict:
    rng = np.random.default_rng(SEED)
    corpus, language = frame.corpus.to_numpy(), frame.language.to_numpy()
    rows = rng.choice(len(frame), size=min(6000, len(frame)), replace=False)
    sims = aligned[rows] @ aligned.T
    sims[corpus[rows][:, None] == corpus[None, :]] = -np.inf
    nearest = np.argpartition(-sims, NEIGHBOURS, axis=1)[:, :NEIGHBOURS]
    observed = float((language[nearest] == language[rows][:, None]).mean())
    expected = float(np.mean([(language[corpus != corpus[r]] == language[r]).mean() for r in rows]))
    return {'same_language': round(observed, 4), 'random': round(expected, 4),
            'gap': round(abs(observed - expected), 4)}


def candidates(frame: pd.DataFrame, vectors: np.ndarray) -> dict[str, np.ndarray]:
    base = space.whiten(frame, vectors)
    return {'whiten-0.1': base, 'whiten-ledoit-wolf': space.whiten(frame, vectors, shrink=None),
            'whiten-0.1-lang-5': remove(base, language_directions(frame, base, 5)),
            'whiten-0.1-lang-20': remove(base, language_directions(frame, base, 20))}


def choose(frame: pd.DataFrame, vectors: np.ndarray) -> tuple[str, np.ndarray, dict]:
    raw = retention_accuracy(frame, vectors)
    floor = translation_odd(frame, space.centre(frame, vectors))
    report, spaces = {'raw_retention': raw, 'centred_translation_odd': floor, 'candidates': {}}, {}
    for name, aligned in candidates(frame, vectors).items():
        kept = retention_accuracy(frame, aligned)
        ratio = float(np.mean([kept[c] / raw[c] for c in kept]))
        row = {'purity': space.purity(frame, aligned)['overall'], 'translation_odd':
               translation_odd(frame, aligned), 'retention': kept, 'retention_ratio': round(ratio, 4),
               'language': language_gap(frame, aligned)}
        row['eligible'] = row['translation_odd'] >= floor and ratio >= RETAIN
        report['candidates'][name], spaces[name] = row, aligned
        print(name, row, flush=True)
    eligible = {n: r for n, r in report['candidates'].items() if r['eligible']}
    if not eligible:
        raise SystemExit('no alignment passes the version 2 rule; nothing is published')
    lowest = min(r['purity'] for r in eligible.values())
    close = {n: r for n, r in eligible.items() if r['purity'] <= lowest + TIE}
    chosen = min(close, key=lambda n: close[n]['language']['gap'])
    report['chosen'] = chosen
    return chosen, spaces[chosen], report
