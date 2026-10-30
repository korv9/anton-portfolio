"""The job-ad clustering lifecycle: evaluate and register, assign new ads, monitor, retrain, diff, roll back.

    evaluate_pipeline  fit one pipeline on the evaluation side over its seeds, save the seed-0 model
                       as an artifact (jobs_model) and return the run record.
    decide             register runs, check candidates against the champion with the frozen
                       criteria (accept.check) and promote only a passed candidate when asked.
    assign             between retrains: diff the store against the champion's snapshot and give
                       new and changed ads a group or -1 with the saved model; writes a monitor file.
    retrain            refit the champion's pipeline on the latest snapshot as a candidate, decide it,
                       and write a version diff against the champion's model.
    rollback           Registry.rollback, optionally on a copy of the registry.
Monitoring raises flags for a person to investigate. Nothing here promotes because of a flag.
"""
from __future__ import annotations

import shutil
from pathlib import Path

import numpy as np

from ml.cluster_lab.io import atomic_json, now, read_json
from . import accept, contract, fit
from . import evaluate as ev
from . import jobs_data, jobs_model
from . import jobs_experiments as ex
from .registry import Registry
from .runtime import measure

OUT = jobs_data.OUT
UNCERTAIN_LINK = 0.3
DRIFT_FLAG = 0.05
ABSTAIN_FLAG = 0.10


def model_folder(run_id: str, out: Path = OUT) -> Path:
    return Path(out) / 'models' / run_id


def evaluate_pipeline(train, pipe: dict, seeds: list, label: str, sample: dict, later=None, out: Path = OUT) -> dict:
    with measure() as used:
        vectors, transformer = ex.vectors(train, pipe)
        labels, _, metrics = fit.evaluate_candidate(vectors, pipe, seeds, ex.confounders(train))
        model = jobs_model.fit_model(vectors, pipe, seeds[0], transformer)
        # The saved model must be the measured fit: 1.0 means the same partition.
        metrics['artifact_label_ari'] = ev.pair_ari(np.asarray(labels), model['labels'])
        if later is not None:
            metrics['temporal'] = ex.temporal(model, train, later, pipe, transformer)
    run = ex.make_run(train, pipe, seeds, 'evaluation', metrics, used, label, sample)
    jobs_model.save(model, model_folder(run['run_id'], out), {
        'run_id': run['run_id'], 'dataset_version': run['dataset_version'], 'snapshot_version': sample['snapshot'],
        'pipeline': pipe, 'seed': seeds[0], 'train_ids': train.id.tolist(), 'label': label})
    return run


def same_pipeline(a: dict, b: dict) -> bool:
    return all(a.get(part) == b.get(part) for part in contract.PIPELINE)


def rule_file(candidate: dict, reference: dict | None) -> str:
    """jobs-refresh judges only a refit of the reference's exact pipeline on another dataset; else jobs."""
    if reference and same_pipeline(candidate['pipeline'], reference['pipeline'])             and candidate['dataset_version'] != reference['dataset_version']:
        return 'jobs-refresh'
    return 'jobs'


def decide(registry: Registry, champion: dict, candidates: list[dict], promote: bool) -> dict:
    """Register, check every candidate against `champion` (the reference run) and decide.
    Returns {run_id: status} and the promoted run, if any."""
    if registry.champion() is None:
        registry.register(champion, 'champion', 'protocol champion: the ml/jobs settings refitted on this corpus')
    else:
        registry.register(champion, reason='refit of the champion settings')
    passed = []
    for run in candidates:
        entry = registry.register(run)
        if entry['status'] == 'candidate' and 'acceptance' not in entry:
            name = rule_file(run, champion)
            rules, sha = accept.criteria(name)
            report = accept.check(run, champion, rules, sha)
            report['criteria_file'] = f'configs/experiments/{name}.yaml'
            registry.decide(run['run_id'], report)
        entry = registry.load()['runs'][run['run_id']]
        if entry['status'] == 'candidate' and entry['acceptance']['passed']:
            passed.append(run)
    promoted = None
    if promote and passed:
        promoted = max(passed, key=lambda r: r['metrics']['seed_stability']['ari_mean'] or 0)['run_id']
        registry.promote(promoted, 'passed every frozen criterion; highest seed ARI among passed candidates')
    state = registry.load()['runs']
    return {'statuses': {r['run_id']: state[r['run_id']]['status'] for r in [champion, *candidates]},
            'promoted': promoted, 'champion': (registry.champion() or {}).get('run_id')}


def drift(model: dict, vectors: np.ndarray) -> dict:
    if not len(vectors):
        return {'new_ads': 0}
    rep = fit.normalise(np.asarray(vectors, dtype=np.float32))
    new = float((rep @ model['train_centre']).mean())
    return {'train_mean_cosine_to_centre': model['train_cosine_to_centre'], 'new_mean_cosine_to_centre': new,
            'shift': model['train_cosine_to_centre'] - new}


def monitor(kind: str, model: dict, manifest: dict, stats: dict, change: dict, labels: np.ndarray,
            vectors: np.ndarray, resources: dict, version: str, out: Path = OUT) -> dict:
    labels = np.asarray(labels, dtype=int)
    train = np.asarray(model['labels'])
    assigned = float((labels >= 0).mean()) if len(labels) else None
    sizes = {int(c): int((train == c).sum()) for c in model['cluster_ids']}
    report = {
        'kind': kind, 'at': now(), 'model_run_id': manifest['run_id'], 'model_dataset_version': manifest['dataset_version'],
        'snapshot_version': version, 'since_snapshot': change['since'],
        'volume': {'store_ads': stats['store_ads'], 'snapshot_ads': stats['dedup']['kept'], 'new': len(change['new']),
                   'changed': len(change['changed']), 'removed': len(change['removed']),
                   'missing_from_store': len(change['missing_from_store'])},
        'dedup_rate': stats['dedup']['dedup_rate'], 'schema_failures': stats['schema_failures'],
        'templates': stats['templates'], 'drift': drift(model, vectors),
        'assignment': {'ads': int(len(labels)), 'assigned_share': assigned,
                       'abstained_share': None if assigned is None else 1 - assigned,
                       'training_abstain_share': model['train_abstain_share'], 'radius_quantile': model['radius_quantile'],
                       'per_cluster': {int(c): int((labels == c).sum()) for c in model['cluster_ids']}},
        'training': {'noise_share': float((train < 0).mean()), 'coverage': float((train >= 0).mean()),
                     'cluster_sizes': sizes, 'cluster_count': len(sizes)},
        'resources': resources, 'flags': [],
    }
    flags = report['flags']
    if stats['schema_failures']:
        flags.append(f"{stats['schema_failures']} ads failed the schema")
    if assigned is not None and 1 - assigned > model['train_abstain_share'] + ABSTAIN_FLAG:
        flags.append('abstentions exceed the training rate by more than 0.10: new kinds of ads may be accumulating; consider a retrain')
    if (report['drift'].get('shift') or 0) > DRIFT_FLAG:
        flags.append(f'mean cosine to the training centre fell by more than {DRIFT_FLAG}: investigate')
    report['action'] = 'investigate' if flags else 'none'
    report['note'] = 'Flags call for a person to look. They never promote or replace a model.'
    atomic_json(Path(out) / 'monitor' / f"{kind}-{version}-{manifest['run_id']}.json", report)
    return report


def champion_model(registry: Registry, out: Path = OUT):
    champ = registry.champion()
    if champ is None:
        raise RuntimeError('the jobs registry has no champion; run final first')
    return jobs_model.load(model_folder(champ['run_id'], out))


def assign(store: Path = jobs_data.STORE, registry: Registry | None = None, out: Path = OUT,
           texts: Path = jobs_data.TEXTS) -> dict:
    registry = registry or Registry('jobs')
    model, manifest = champion_model(registry, out)
    with measure() as used:
        frame, stats = jobs_data.prepare(jobs_data.load_store(store))
        snap = jobs_data.snapshot(frame, stats)
        version = jobs_data.save(frame, snap, texts, out)
        previous = read_json(Path(out) / 'snapshots' / f"{manifest['snapshot_version']}.json")
        change = jobs_data.diff(previous, frame)
        targets = frame[frame.id.isin(change['new'] + change['changed'])]
        vectors = (ex.vectors(targets, manifest['pipeline'], transformer=model['transformer'])[0]
                   if len(targets) else np.zeros((0, 1)))
        labels, distance = (jobs_model.assign(model, vectors) if len(targets) else (np.array([], int), np.array([])))
    rows = [{'id': i, 'cluster': int(c), 'key': contract.cluster_key(manifest['run_id'], int(c)),
             'distance': round(float(d), 4)} for i, c, d in zip(targets.id, labels, distance)]
    atomic_json(Path(out) / 'assignments' / f"{manifest['run_id']}-{version}.json",
                {'model_run_id': manifest['run_id'], 'snapshot_version': version, 'at': now(),
                 'note': '-1 means the ad fits no group of this model', 'ads': rows})
    report = monitor('assign', model, manifest, stats, change, labels, vectors, used, version, out)
    return {'snapshot_version': version, 'assigned': len(rows), 'monitor': report}


def version_diff(old: tuple[dict, dict], new: tuple[dict, dict], threshold: float = UNCERTAIN_LINK) -> dict:
    """Match clusters of two models by Jaccard overlap of the ads both were trained on, plus centroid
    cosine in the representation space when both use the same embedding."""
    (om, oman), (nm, nman) = old, new
    o_lab = dict(zip(oman['train_ids'], map(int, om['labels'])))
    n_lab = dict(zip(nman['train_ids'], map(int, nm['labels'])))
    shared = sorted(set(o_lab) & set(n_lab))
    same_space = oman['pipeline']['embedding'] == nman['pipeline']['embedding']
    links = []
    for a in om['cluster_ids']:
        A = {i for i in shared if o_lab[i] == a}
        for b in nm['cluster_ids']:
            B = {i for i in shared if n_lab[i] == b}
            if not A & B:
                continue
            cos = None
            if same_space:
                cos = float(om['rep_centroids'][list(om['cluster_ids']).index(a)] @ nm['rep_centroids'][list(nm['cluster_ids']).index(b)])
            links.append({'old': contract.cluster_key(oman['run_id'], int(a)), 'new': contract.cluster_key(nman['run_id'], int(b)),
                          'jaccard': round(len(A & B) / len(A | B), 4), 'shared': len(A & B), 'centroid_cosine': cos})
    strong = [l for l in links if l['jaccard'] >= threshold]
    by_old, by_new = {}, {}
    for l in strong:
        by_old.setdefault(l['old'], []).append(l['new'])
        by_new.setdefault(l['new'], []).append(l['old'])
    olds = {contract.cluster_key(oman['run_id'], int(a)) for a in om['cluster_ids']}
    news = {contract.cluster_key(nman['run_id'], int(b)) for b in nm['cluster_ids']}
    return {'old_run_id': oman['run_id'], 'new_run_id': nman['run_id'], 'shared_ads': len(shared),
            'uncertain_below': threshold, 'links': sorted(links, key=lambda l: -l['jaccard']),
            'matched': [[o, n[0]] for o, n in by_old.items() if len(n) == 1 and len(by_new[n[0]]) == 1],
            'splits': {o: n for o, n in by_old.items() if len(n) > 1},
            'merges': {n: o for n, o in by_new.items() if len(o) > 1},
            'uncertain_old': sorted(olds - set(by_old)), 'uncertain_new': sorted(news - set(by_new)),
            'note': 'Cluster ids are run-bound; a link is overlap of shared training ads, not identity.'}


def retrain(version: str, registry: Registry | None = None, out: Path = OUT, texts: Path = jobs_data.TEXTS,
            promote: bool = False) -> dict:
    """Refit the champion's pipeline on snapshot `version` and decide it as a candidate."""
    registry = registry or Registry('jobs')
    old = champion_model(registry, out)
    frame, snap = jobs_data.load(version, texts, out)
    evaluation = frame[~ex.sides(frame)].reset_index(drop=True)
    pipe = old[1]['pipeline']
    sample = {'snapshot': version, 'side': 'evaluation', 'ads': int(len(evaluation)), 'snapshot_ads': int(len(frame))}
    run = evaluate_pipeline(evaluation, pipe, ex.FINAL_SEEDS, 'retrain: champion settings on the latest snapshot',
                            sample, out=out)
    champion = registry.champion()
    result = decide(registry, champion, [run], promote)
    change = version_diff(old, jobs_model.load(model_folder(run['run_id'], out)))
    atomic_json(Path(out) / 'diffs' / f"{champion['run_id']}__{run['run_id']}.json", change)
    return {'run_id': run['run_id'], **result, 'diff': {k: change[k] for k in ('shared_ads', 'matched', 'splits', 'merges',
                                                                               'uncertain_old', 'uncertain_new')}}


def rollback(reason: str, registry: Registry | None = None, copy_to: Path | None = None) -> str:
    registry = registry or Registry('jobs')
    if copy_to is not None:
        target = Path(copy_to) / registry.domain
        shutil.copytree(registry.folder, target, dirs_exist_ok=True, ignore=shutil.ignore_patterns('*.lock'))
        registry = Registry(registry.domain, copy_to)
    return registry.rollback(reason)
