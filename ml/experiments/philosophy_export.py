"""Philosophy Lab `export`: one Cluster Visuals file per registered run, then the shared index.

Per run: its own 2-D UMAP of its representation, and per group its size, dominant work and
translator with their shares, generated distinctive terms (the published pipeline's class-based
TF-IDF, marked unreviewed), the three passages nearest the group's centre in the clustered space
and one borderline passage (the member nearest another group's centre, relative to its own).
Excerpts are of public-domain Gutenberg texts the Philosophy Atlas already publishes.
"""
from __future__ import annotations

from collections import Counter

import numpy as np

from . import export as out
from . import fit
from . import philosophy as ph
from .registry import Registry
from .runtime import heavy

NAME_STATUS = 'generated terms, unreviewed'
MAP_SPEC = {'kind': 'umap', 'dims': 2, 'neighbors': 15, 'min_dist': 0.1, 'metric': 'cosine'}


def dominant(values: list[str]) -> list:
    value, count = Counter(values).most_common(1)[0]
    return [value, round(count / len(values), 3)]


def groups(sample, labels: np.ndarray, space: np.ndarray) -> list[dict]:
    clusters = sorted(set(labels.tolist()) - {-1})
    if not clusters:
        return []
    centres = np.stack([space[labels == c].mean(axis=0) for c in clusters])
    distance = ((space[:, None, :] - centres[None, :, :]) ** 2).sum(axis=2) ** 0.5
    terms = ph.platform_pipeline().ctfidf_terms(sample['text'].tolist(), labels)
    rows = sample.reset_index(drop=True)

    def example(i: int, kind: str) -> dict:
        r = rows.iloc[i]
        return {'id': r.observation_id, 'kind': kind, 'text': r.text,
                'source': {'work': r.title, 'author': r.author, 'translator': r.translator_name if isinstance(r.translator_name, str) else None}}

    result = []
    for j, c in enumerate(clusters):
        members = np.flatnonzero(labels == c)
        own = distance[members, j]
        other = np.delete(distance[members], j, axis=1).min(axis=1) if len(clusters) > 1 else np.full(len(members), np.inf)
        nearest = members[np.argsort(own)[:3]]
        borderline = members[int(np.argmax(own / np.maximum(other, 1e-12)))]
        result.append({
            'cluster': int(c), 'size': int(len(members)), 'terms': terms.get(c, []), 'name_status': NAME_STATUS,
            'dominant': {'work': dominant(rows.title.iloc[members].tolist()),
                         'translator': dominant(rows.translator.iloc[members].tolist())},
            'works': int(rows.document_id.iloc[members].nunique()),
            'examples': [example(i, 'representative') for i in nearest]
                        + ([example(borderline, 'borderline')] if borderline not in nearest else []),
        })
    return result


def export() -> None:
    frame, _ = ph.load()
    sample = ph.sampled(frame, 'evaluation')
    for run_id, entry in Registry(ph.DOMAIN).load()['runs'].items():
        saved = np.load(ph.WORK / 'final' / f'{run_id}.npz', allow_pickle=False)
        if list(saved['ids']) != sample['observation_id'].tolist():
            raise RuntimeError(f'{run_id}: saved labels do not match the evaluation sample')
        p, run = entry['run']['pipeline'], entry['run']
        model = next(k for k, v in ph.MODELS.items() if v['model'] == p['embedding']['model'])
        vectors, _ = ph.vectors(sample, model, p['text']['unit'])
        rep = fit.represent(vectors, p['representation']['kind'], sample['document_id'].to_numpy())
        with heavy(wait_seconds=3600):
            xy = fit.reduce(rep, MAP_SPEC, run['seeds'][0])
        labels = saved['labels']
        points = [[i, x, y, int(l)] for i, (x, y), l in zip(sample['observation_id'], xy, labels)]
        path = out.run_file(entry, points, groups(sample, labels, saved['space']))
        print(f'{run_id} {entry["status"]:9} -> {path}', flush=True)
    print(out.index())
