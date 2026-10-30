"""Cluster Visuals files for every registered Replik run (ml/experiments/export.py).

Per group: size, the dominant party and speaker with their shares, generated c-TF-IDF terms
(unreviewed), passages per decade, three representative passages (closest to the group centroid
in the representation) and one borderline passage (smallest margin to the next group's centroid).
Passages are public parliamentary record and are cut to export.EXCERPT characters.
"""
from __future__ import annotations

import numpy as np

from . import export, fit, runtime
from . import debates as dbt
from . import debates_select as sel
from .fit import normalise
from .registry import Registry

MAP = {'kind': 'umap', 'dims': 2, 'neighbors': 15, 'min_dist': 0.1, 'metric': 'cosine'}


def source(row) -> dict:
    return {'debate_id': row.debate_id, 'date': row.date, 'speaker': row.speaker, 'party': row.party,
            'record': 'Riksdag party-leader debate, public parliamentary record'}


def groups(obs, rep: np.ndarray, labels: np.ndarray) -> list[dict]:
    from ml.research.consensus import SWEDISH, terms
    words = terms(obs.text.tolist(), labels, list(SWEDISH), top=8)
    ids = sorted(set(labels[labels >= 0]))
    centroids = normalise(np.stack([rep[labels == c].mean(axis=0) for c in ids]))
    out = []
    for i, c in enumerate(ids):
        rows = np.flatnonzero(labels == c)
        sims = rep[rows] @ centroids.T
        own = sims[:, i]
        others = np.delete(sims, i, axis=1).max(axis=1) if len(ids) > 1 else np.zeros(len(rows))
        picks = [(r, 'representative') for r in rows[np.argsort(-own)[:3]]]
        picks.append((rows[np.argmin(own - others)], 'borderline'))
        part = obs.iloc[rows]
        dominant = {}
        for field in ('party', 'speaker'):
            counts = part[field].value_counts()
            dominant[field] = [str(counts.index[0]), round(float(counts.iloc[0] / len(rows)), 3)]
        out.append({'cluster': int(c), 'size': int(len(rows)), 'terms': words.get(int(c), []),
                    'name_status': 'generated terms, unreviewed', 'dominant': dominant,
                    'decades': {str(k): int(v) for k, v in part.decade.value_counts().sort_index().items()},
                    'examples': [{'id': obs.observation_id.iloc[r], 'kind': kind, 'text': obs.text.iloc[r],
                                  'source': source(obs.iloc[r])} for r, kind in picks]})
    return out


def export_all(deadline) -> dict:
    obs = dbt.evaluation_side()
    marks = runtime.Checkpoints(dbt.FOLDER / 'final')
    state = Registry('debates').load()
    written = {}
    for label, (rep_name, _) in dbt.RUNS.items():
        if not marks.done(label) or deadline.expired():
            continue
        run = marks.get(label)
        entry = state['runs'].get(run['run_id'])
        if entry is None:
            continue
        labels = np.load(dbt.FOLDER / 'final' / f'{label}-labels.npy')
        rep = sel.representation(obs, rep_name)
        mpath = dbt.FOLDER / 'final' / f'{label}-map.npy'
        if not mpath.exists():
            np.save(mpath, fit.reduce(rep, MAP, 10).astype(np.float32))
        xy = np.load(mpath)
        points = [[o, x, y, l] for o, (x, y), l in zip(obs.observation_id, xy, labels)]
        written[label] = str(export.run_file(entry, points, groups(obs, rep, labels)))
    written['index'] = str(export.index())
    return written
