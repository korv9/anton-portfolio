"""Replik selection side: which text, embedding, representation and clustering to carry forward.

Only the selection half of the debates and seeds 0, 1, 2 are used. Each representation (text
version x model x centring) gets one UMAP 5-D space per seed, cached as .npy; every clustering of
the small grid is then measured on those spaces with the shared measures (ml/experiments/evaluate.py)
plus time coverage: noise share per decade and how many groups appear in at least three decades.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from ml.cluster_lab.io import now
from . import embed, evaluate as ev, fit
from . import debates_data as data
from .runtime import Checkpoints, measure

MODELS = {
    'sbert': {'model': 'KBLab/sentence-bert-swedish-cased', 'revision': '6b5e83cd29c03729cfdc33d13b1423399b0efb5c',
              'prefix': ''},
    # The e5 card asks for a 'query: ' prefix on symmetric tasks such as clustering.
    'e5-base': {'model': 'intfloat/multilingual-e5-base', 'revision': 'd128750597153bb5987e10b1c3493a34e5a4502a',
                'prefix': 'query: '},
    'minilm': {'model': 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2',
               'revision': 'e8f8c211226b894fcb81acc59f3b34ba3efd5f42', 'prefix': ''},
}
# (text version, model, centring group). The first is the champion's representation.
REPRESENTATIONS = {
    'sbert-speaker': ('current', 'sbert', 'speaker'),
    'sbert-raw': ('current', 'sbert', 'none'),
    'sbert-party': ('current', 'sbert', 'party'),
    'sbert-masked-speaker': ('masked', 'sbert', 'speaker'),
    'e5-base-speaker': ('current', 'e5-base', 'speaker'),
    'minilm-speaker': ('current', 'minilm', 'speaker'),
}
REDUCTION = {'kind': 'umap', 'dims': 5, 'neighbors': 30, 'min_dist': 0.0, 'metric': 'cosine'}
# min_cluster_size as a share of passages: the champion's 150 per 33,023.
MCS = round(150 / 33023, 6)
CLUSTERINGS = {
    'hdbscan-150-25': {'method': 'hdbscan', 'min_cluster_size': MCS, 'min_samples': 25, 'selection': 'eom'},
    'hdbscan-150-10': {'method': 'hdbscan', 'min_cluster_size': MCS, 'min_samples': 10, 'selection': 'eom'},
    'hdbscan-300-25': {'method': 'hdbscan', 'min_cluster_size': 2 * MCS, 'min_samples': 25, 'selection': 'eom'},
    'kmeans-30': {'method': 'kmeans', 'k': 30},
}
SEEDS = [0, 1, 2]
CONFOUNDERS = ('party', 'speaker', 'debate_id')


def vectors(obs: pd.DataFrame, model_key: str, text_key: str, deadline=None) -> np.ndarray:
    m = MODELS[model_key]
    column, hashes = ('text', 'text_hash') if text_key == 'current' else ('text_masked', 'text_hash_masked')
    return embed.embed(obs[column].tolist(), obs[hashes].tolist(), m['model'], m['revision'],
                       data.TEXT_VERSIONS[text_key], prefix=m['prefix'], batch=4096, deadline=deadline)


def representation(obs: pd.DataFrame, name: str, deadline=None) -> np.ndarray:
    text_key, model_key, centring = REPRESENTATIONS[name]
    return data.centre(vectors(obs, model_key, text_key, deadline), data.centring_groups(obs, centring))


def time_coverage(labels: np.ndarray, decades: np.ndarray, present_share: float = 0.05) -> dict:
    """Noise share per decade; a group is present in a decade holding >= present_share of it."""
    decades = np.asarray(decades).astype(str)
    out = {'noise_by_decade': {d: float((labels[decades == d] < 0).mean()) for d in sorted(set(decades))}}
    spans = []
    for c in sorted(set(labels[labels >= 0])):
        values, counts = np.unique(decades[labels == c], return_counts=True)
        spans.append(int((counts / counts.sum() >= present_share).sum()))
    out['groups_in_3plus_decades'] = int(sum(s >= 3 for s in spans))
    out['groups_in_1_decade'] = int(sum(s == 1 for s in spans))
    out['present_share'] = present_share
    return out


def measure_labelings(labelings, space, rep, obs) -> dict:
    labels = labelings[0]
    metrics = ev.structure(labels)
    metrics['seed_stability'] = ev.seed_stability(labelings)
    metrics['separation_clustered'] = ev.separation(space, labels, 'euclidean')
    metrics['separation_representation'] = ev.separation(rep, labels, 'cosine')
    metrics['dominance'] = {f.replace('_id', ''): ev.dominance(labels, obs[f].to_numpy(), nulls=100)
                            for f in CONFOUNDERS}
    metrics['seed_noise_shares'] = [float((l < 0).mean()) for l in labelings]
    metrics['seed_cluster_counts'] = [int(len(set(l[l >= 0]))) for l in labelings]
    metrics['time'] = time_coverage(labels, obs.decade.to_numpy())
    return metrics


def run(folder, deadline) -> dict:
    """Fit and measure every representation x clustering; resumable per unit."""
    obs = data.load()
    obs = obs[obs.selection].reset_index(drop=True)
    marks = Checkpoints(folder / 'select')
    spaces = folder / 'select-spaces'
    spaces.mkdir(parents=True, exist_ok=True)
    for name in REPRESENTATIONS:
        if all(marks.done(f'{name}--{c}') for c in CLUSTERINGS) and marks.done(f'{name}--kmeans-30-full'):
            continue
        if deadline.expired():
            break
        with measure() as res:
            rep = representation(obs, name, deadline)
            seeds_space = []
            for seed in SEEDS:
                path = spaces / f'{name}-{seed}.npy'
                if not path.exists():
                    np.save(path, fit.reduce(rep, REDUCTION, seed).astype(np.float32))
                seeds_space.append(np.load(path))
        for cname, spec in CLUSTERINGS.items():
            key = f'{name}--{cname}'
            if marks.done(key):
                continue
            with measure() as cres:
                labelings = [fit.cluster(s, spec, seed) for s, seed in zip(seeds_space, SEEDS)]
                metrics = measure_labelings(labelings, seeds_space[0], rep, obs)
            marks.put(key, {'representation': name, 'clustering': cname, 'spec': spec, 'metrics': metrics,
                            'resources': {'embed_and_umap': res, 'cluster_and_measure': cres}, 'at': now()})
        key = f'{name}--kmeans-30-full'
        if name == 'sbert-speaker' and not marks.done(key):
            # Baseline without UMAP: K-means directly on the 768-D representation.
            with measure() as cres:
                labelings = [fit.cluster(rep, {'method': 'kmeans', 'k': 30}, seed) for seed in SEEDS]
                metrics = measure_labelings(labelings, rep, rep, obs)
            marks.put(key, {'representation': name, 'clustering': 'kmeans-30 on 768-D',
                            'spec': {'method': 'kmeans', 'k': 30, 'reduction': 'none'}, 'metrics': metrics,
                            'resources': {'cluster_and_measure': cres}, 'at': now()})
        elif name != 'sbert-speaker':
            marks.put(key, {'skipped': 'only run for the champion representation'})
    return marks.all()


def table(results: dict) -> pd.DataFrame:
    rows = []
    for key, r in results.items():
        if 'metrics' not in r:
            continue
        m, d = r['metrics'], r['metrics']['dominance']
        rows.append({'run': key, 'groups': m['cluster_count'], 'noise': m['noise_share'],
                     'largest': m['largest_cluster_share'], 'ari': m['seed_stability']['ari_mean'],
                     'sil_rep': m['separation_representation'], 'sil_clu': m['separation_clustered'],
                     'party_ami': d['party']['ami'], 'party_top': d['party']['weighted_top_share'],
                     'party_null95': d['party']['null_top_share_p95'],
                     'speaker_ami': d['speaker']['ami'], 'debate_ami': d['debate']['ami'],
                     'debate_top': d['debate']['weighted_top_share'],
                     'debate_null95': d['debate']['null_top_share_p95'],
                     'groups_3dec': m['time']['groups_in_3plus_decades'],
                     **{f'noise_{k}': v for k, v in m['time']['noise_by_decade'].items()}})
    return pd.DataFrame(rows)
