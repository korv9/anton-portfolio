"""Philosophy Lab `select` and `final` (docs/cluster-experiments-philosophy.md).

select: on the selection side, seeds 0-2, every embedding variant (model x passage unit) and
representation (raw, centred on the work) is reduced once per seed and clustered with a small
HDBSCAN grid and a K-means baseline. One checkpoint per configuration; a rerun skips finished ones.
final: on the evaluation side, seeds 10-14, the champion (the published pipeline) and the
candidates chosen from select are fitted with fit.evaluate_candidate, registered and judged.
"""
from __future__ import annotations

import numpy as np

from ml.cluster_lab.io import atomic_json, digest, now
from . import accept, contract
from . import evaluate as ev
from . import fit
from . import philosophy as ph
from .registry import Registry
from .runtime import Checkpoints, Deadline, heavy, measure

SELECTION_SEEDS = [0, 1, 2]
EVALUATION_SEEDS = [10, 11, 12, 13, 14]
EMBEDDINGS = [('minilm', 'passage'), ('minilm', 'chunks80'), ('mpnet', 'passage'), ('bge-small', 'passage')]
REPRESENTATIONS = ['raw', 'centred']
UMAP10 = {'kind': 'umap', 'dims': 10, 'neighbors': 15, 'min_dist': 0.0, 'metric': 'cosine'}
CLUSTERINGS = ([{'method': 'hdbscan', 'min_cluster_size': m, 'min_samples': 8} for m in (12, 25, 40)]
               + [{'method': 'kmeans', 'k': k} for k in (6, 10, 15)])
MAP = '2-D UMAP of the representation (n_neighbors 15, min_dist 0.1, cosine, first seed)'


def pipeline(model: str, unit: str, representation: str, clustering: dict) -> dict:
    return {'text': {'version': ph.TEXT_VERSION, 'unit': unit, 'unit_note': ph.UNITS[unit],
                     'sample': 'at most 200 passages per work, evenly spaced (published rule)'},
            'embedding': {k: ph.MODELS[model][k] for k in ('model', 'revision', 'max_tokens')},
            'representation': {'kind': representation, **({'group': 'document_id'} if representation == 'centred' else {})},
            'reduction': UMAP10, 'clustering': clustering, 'map': MAP}


# The published pipeline: MiniLM, the work-centred map the site shows by default (karta=author_centered),
# UMAP 10-D n15 min_dist 0, HDBSCAN min_cluster_size 25, min_samples 8.
CHAMPION = pipeline('minilm', 'passage', 'centred', {'method': 'hdbscan', 'min_cluster_size': 25, 'min_samples': 8})
# Chosen after `select` (selection side only); reasons in docs/cluster-experiments-philosophy.md.
CANDIDATES: list[tuple[str, dict]] = [
    ('candidate: champion with HDBSCAN min_cluster_size 40',
     pipeline('minilm', 'passage', 'centred', {'method': 'hdbscan', 'min_cluster_size': 40, 'min_samples': 8})),
    ('candidate: champion space, K-means k=10',
     pipeline('minilm', 'passage', 'centred', {'method': 'kmeans', 'k': 10})),
    ('candidate: bge-small-en-v1.5 (reads the whole passage), HDBSCAN 40/8',
     pipeline('bge-small', 'passage', 'centred', {'method': 'hdbscan', 'min_cluster_size': 40, 'min_samples': 8})),
]


def metrics_for(rep: np.ndarray, spaces: list, labelings: list, confounders: dict) -> dict:
    """The metrics fit.evaluate_candidate computes, for spaces already reduced (shared across clusterings)."""
    labels = labelings[0]
    metrics = ev.structure(labels)
    metrics['seed_stability'] = ev.seed_stability(labelings)
    metrics['separation_clustered'] = ev.separation(spaces[0], labels, 'euclidean')
    metrics['separation_representation'] = ev.separation(rep, labels, 'cosine')
    metrics['dominance'] = {n: ev.dominance(labels, v) for n, v in confounders.items()}
    metrics['seed_noise_shares'] = [float((l < 0).mean()) for l in labelings]
    metrics['seed_cluster_counts'] = [int(len(set(l[l >= 0]))) for l in labelings]
    return metrics


def neighbours(rep: np.ndarray, confounders: dict) -> dict:
    return {n: ev.neighbour_share(rep, v, k=10) for n, v in confounders.items()}


def select(deadline_minutes: float | None = None) -> list[dict]:
    frame, meta = ph.load()
    sample = ph.sampled(frame, 'selection')
    conf, groups = ph.confounders(sample), sample['document_id'].to_numpy()
    store, deadline = Checkpoints(ph.WORK / 'select'), Deadline(deadline_minutes)
    for model, unit in EMBEDDINGS:
        for kind in REPRESENTATIONS:
            todo = [c for c in CLUSTERINGS if not store.done(key(pipeline(model, unit, kind, c)))]
            if not todo:
                continue
            if deadline.expired():
                print('deadline reached; rerun to resume', flush=True)
                return summary(store)
            vectors, embed_used = ph.vectors(sample, model, unit)
            rep = fit.represent(vectors, kind, groups)
            near = neighbours(rep, conf)
            with heavy(wait_seconds=3600), measure(ph.WORK) as reduce_used:
                spaces = [fit.reduce(rep, UMAP10, s) for s in SELECTION_SEEDS]
            for c in todo:
                p = pipeline(model, unit, kind, c)
                with measure(ph.WORK) as used:
                    labelings = [fit.cluster(space, c, s) for space, s in zip(spaces, SELECTION_SEEDS)]
                    metrics = metrics_for(rep, spaces, labelings, conf)
                metrics['neighbour_share'] = near
                store.put(key(p), {'pipeline': p, 'model': model, 'unit': unit, 'representation': kind,
                                   'clustering': c, 'seeds': SELECTION_SEEDS, 'side': 'selection',
                                   'dataset_version': meta['dataset_version'], 'observations': int(len(sample)),
                                   'metrics': metrics, 'resources': {'cluster_and_measure': used,
                                   'reduce_three_seeds': reduce_used, 'embed': embed_used}})
                print(row(store.get(key(p))), flush=True)
    return summary(store)


def key(p: dict) -> str:
    return digest(p)[:16]


def row(r: dict) -> str:
    m, c = r['metrics'], r['clustering']
    d = m['dominance']
    fmt = lambda x: 'n/a' if x is None else f'{x:.3f}'
    cl = f"hdb{c['min_cluster_size']}" if c['method'] == 'hdbscan' else f"km{c['k']}"
    return (f"{r['model']:9} {r['unit']:8} {r['representation']:7} {cl:6} groups {m['cluster_count']:2} "
            f"noise {m['noise_share']:.3f} ari {fmt(m['seed_stability']['ari_mean'])} "
            f"work {fmt(d['work']['weighted_top_share'])} (null95 {fmt(d['work']['null_top_share_p95'])}) "
            f"transl {fmt(d['translator']['weighted_top_share'])} lang {fmt(d['original_language']['weighted_top_share'])} "
            f"genre {fmt(d['genre']['weighted_top_share'])} sil_rep {fmt(m['separation_representation'])} "
            f"nn_work {m['neighbour_share']['work']['same_share']:.3f}")


def summary(store: Checkpoints) -> list[dict]:
    rows = sorted(store.all().values(), key=lambda r: (r['model'], r['unit'], r['representation'], str(r['clustering'])))
    atomic_json(ph.WORK / 'selection.json', {'generated_at': now(), 'rows': rows})
    return rows


def run_record(p: dict, metrics: dict, resources: dict, meta: dict, observations: int, label: str,
               limitations: list[str], seeds: list[int] = EVALUATION_SEEDS, role: str = 'evaluation') -> dict:
    run = {'domain': ph.DOMAIN, 'question': ph.QUESTION, 'corpus': ph.CORPUS,
           'sample': {'side': role, 'observations': observations, 'rule': p['text']['sample'],
                      'works': meta['sides']['evaluation']['works'] if role == 'evaluation' else None},
           'dataset_version': meta['dataset_version'], 'pipeline': p, 'seeds': list(seeds), 'role': role,
           'metrics': metrics, 'resources': resources, 'limitations': limitations, 'created_at': now(),
           'label': label}
    run['run_id'] = contract.run_id(ph.DOMAIN, meta['dataset_version'], p, list(seeds), role)
    return run


LIMITATIONS = [
    'Evaluation side holds 7 of 13 works (1,400 sampled passages); every measure is on those works only.',
    'Translator is confounded with work: most works have their own translator, and three English originals share one value.',
    'Groups are computed, not interpreted; their terms are generated and unreviewed.',
    'Champion refitted under the protocol (seeds 10-14, evaluation works only); its numbers differ from the published 13-work run.',
]


def judge(registry: Registry, champion: dict, candidate: dict, rules=None) -> str:
    rules, sha = rules or accept.criteria(ph.DOMAIN)
    return registry.decide(candidate['run_id'], accept.check(candidate, champion, rules, sha))


def final(deadline_minutes: float | None = None) -> dict:
    frame, meta = ph.load()
    sample = ph.sampled(frame, 'evaluation')
    conf, groups = ph.confounders(sample), sample['document_id'].to_numpy()
    store, deadline, registry = Checkpoints(ph.WORK / 'final'), Deadline(deadline_minutes), Registry(ph.DOMAIN)
    runs = {}
    for label, p in [('champion: published pipeline (MiniLM, work-centred, HDBSCAN 25/8)', CHAMPION), *CANDIDATES]:
        model = next(k for k, v in ph.MODELS.items() if v['model'] == p['embedding']['model'])
        k = key(p)
        if not store.done(k):
            if deadline.expired():
                print('deadline reached; rerun to resume', flush=True)
                break
            vectors, embed_used = ph.vectors(sample, model, p['text']['unit'])
            with heavy(wait_seconds=3600), measure(ph.WORK) as used:
                labels, space, metrics = fit.evaluate_candidate(vectors, p, EVALUATION_SEEDS, conf, groups)
            metrics['neighbour_share'] = neighbours(fit.represent(vectors, p['representation']['kind'], groups), conf)
            run = run_record(p, metrics, {'fit_five_seeds': used, 'embed': embed_used}, meta, len(sample), label,
                             LIMITATIONS)
            np.savez_compressed(ph.WORK / 'final' / f"{run['run_id']}.npz", labels=labels, space=space,
                                ids=sample['observation_id'].to_numpy().astype(str))
            store.put(k, run)
        runs[k] = store.get(k)
    champion = runs.get(key(CHAMPION))
    if champion is None:
        return runs
    registry.register(champion, 'champion', 'published pipeline refitted under protocol')
    for k, run in runs.items():
        if k == key(CHAMPION):
            continue
        entry = registry.register(run, 'candidate', 'chosen on the selection side')
        if entry['status'] == 'candidate' and 'acceptance' not in entry:
            status = judge(registry, champion, run)
            print(run['label'], status, flush=True)
            # ponytail: the first passing candidate in CANDIDATES order is promoted; a later one stays a candidate.
            if status == 'candidate' and registry.champion()['run_id'] == champion['run_id']:
                registry.promote(run['run_id'], 'passed every frozen criterion on the evaluation side')
    return runs
