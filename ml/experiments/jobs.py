"""Job-ad clustering experiments and their MLOps lifecycle (docs/cluster-experiments-jobs.md).

    python -m ml.experiments.jobs prepare [--hold-out-newest 0.15]   versioned, cleaned, deduplicated snapshot
    python -m ml.experiments.jobs select   [--deadline-minutes N]    selection side, seeds 0-2, checkpointed
    python -m ml.experiments.jobs final    [--deadline-minutes N]    evaluation side, seeds 10-14, register, decide
    python -m ml.experiments.jobs export                             cluster-experiments run files and index
    python -m ml.experiments.jobs assign                             new/changed ads -> group or -1, monitor file
    python -m ml.experiments.jobs monitor                            print the latest monitor file and its flags
    python -m ml.experiments.jobs retrain  [--promote]               champion settings on the latest snapshot
    python -m ml.experiments.jobs promote  --run-id ID               only a candidate with a passed report
    python -m ml.experiments.jobs rollback --reason TEXT [--copy-to DIR]
"""
from __future__ import annotations

import argparse
from contextlib import contextmanager
import json
import re
from pathlib import Path

import numpy as np
import pandas as pd

from ml.cluster_lab.io import atomic_json, read_json
from . import export as public
from . import jobs_data, jobs_model, jobs_mlops
from . import jobs_experiments as ex
from .fit import normalise
from .registry import Registry
from .runtime import Checkpoints, Deadline, heavy

OUT = jobs_data.OUT
STATE = OUT / 'state.json'
CONTACT = re.compile(r'\S+@\S+|\+?\d[\d \-]{6,}\d')


HELD = False


@contextmanager
def heavy_once():
    """runtime.heavy, taken once per process: a driver holding it can call several steps."""
    global HELD
    if HELD:
        yield
        return
    with heavy(wait_seconds=3600):
        HELD = True
        try:
            yield
        finally:
            HELD = False


def state() -> dict:
    return read_json(STATE) if STATE.exists() else {}


def set_state(**values) -> None:
    atomic_json(STATE, {**state(), **values})


def prepared() -> tuple[str, pd.DataFrame, dict]:
    version = state().get('prepared')
    if not version:
        raise SystemExit('no prepared snapshot; run prepare first')
    frame, snap = jobs_data.load(version)
    return version, frame, snap


def prepare(args) -> dict:
    frame, stats = jobs_data.prepare(jobs_data.load_store(args.store), hold_out_newest=args.hold_out_newest)
    version = jobs_data.save(frame, jobs_data.snapshot(frame, stats))
    set_state(prepared=version, latest=version)
    return {'dataset_version': version, **{k: v for k, v in stats.items() if k != 'schema_failure_examples'}}


def select(args) -> dict:
    version, frame, _ = prepared()
    chosen = frame[ex.sides(frame)].reset_index(drop=True)
    checkpoints = Checkpoints(OUT / 'checkpoints' / f'select-{version}')
    with heavy_once():
        results = ex.run_units(ex.selection_units(chosen, args.deadline), checkpoints, args.deadline)
    picks = ex.pick(results)
    body = {'dataset_version': version, 'selection_ads': int(len(chosen)), 'seeds': ex.SELECTION_SEEDS,
            'rule': ex.PICK_RULE, 'picks': picks, 'champion': ex.CHAMPION,
            'results': {k: {'pipeline': r['pipeline'], 'metrics': r['metrics']} for k, r in results.items()}}
    atomic_json(OUT / 'selection' / f'{version}.json', body)
    return {'picks': picks, 'fits': len(results)}


def later_ads(snap: dict, store: Path) -> pd.DataFrame:
    """Ads the store holds that a held-out snapshot left out (published on or after its cut)."""
    as_of = snap['stats'].get('as_of')
    if not as_of:
        return pd.DataFrame()
    full, _ = jobs_data.prepare(jobs_data.load_store(store))
    return full[(full.published >= as_of) & ~full.id.isin(snap['ads'])].reset_index(drop=True)


def final(args) -> dict:
    version, frame, snap = prepared()
    path = OUT / 'selection' / f'{version}.json'
    if not path.exists():
        raise SystemExit(f'no selection for {version}; run select first')
    selection = read_json(path)
    evaluation = frame[~ex.sides(frame)].reset_index(drop=True)
    later = later_ads(snap, args.store)
    sample = {'snapshot': version, 'side': 'evaluation', 'ads': int(len(evaluation)), 'snapshot_ads': int(len(frame)),
              'later_ads': int(len(later)), 'as_of': snap['stats'].get('as_of')}
    plan = {'champion': (ex.CHAMPION, 'champion: ml/jobs settings on this corpus')}
    for key in selection['picks']:
        plan[key] = (selection['results'][key]['pipeline'], f'candidate: {key}')
    units = {key: (lambda p=p, label=label: jobs_mlops.evaluate_pipeline(evaluation, p, ex.FINAL_SEEDS, label, sample, later))
             for key, (p, label) in plan.items()}
    with heavy_once():
        runs = ex.run_units(units, Checkpoints(OUT / 'checkpoints' / f'final-{version}'), args.deadline)
    result = jobs_mlops.decide(Registry('jobs'), runs['champion'], [r for k, r in runs.items() if k != 'champion'],
                               promote=True)
    atomic_json(OUT / 'final' / f'{version}.json', {'dataset_version': version, 'runs': {k: r['run_id'] for k, r in runs.items()},
                                                    **result})
    return result


def excerpt(row) -> str:
    body = row.text_clean.split('DESCRIPTION: ', 1)[-1].split('\nSKILLS:', 1)[0]
    return CONTACT.sub('[kontakt]', f'{row.headline}: {body}')


def groups(frame: pd.DataFrame, model: dict, rep: np.ndarray) -> list[dict]:
    labels = model['labels']
    words = ex.terms(frame.text_clean.tolist(), labels)
    out = []
    for i, c in enumerate(model['rep_centroids'] if len(model['cluster_ids']) else []):
        cid = int(model['cluster_ids'][i])
        members = np.flatnonzero(labels == cid)
        nearest = members[np.argsort(-(rep[members] @ c))[:3]]
        top = frame.employer_name.iloc[members].value_counts()
        out.append({'cluster': cid, 'size': int(len(members)), 'terms': words.get(cid, []),
                    'name_status': 'generated: c-TF-IDF terms, unreviewed',
                    'dominant': {'employer': [str(top.index[0]), round(float(top.iloc[0] / len(members)), 3)],
                                 'occupation': [str(frame.occupation.iloc[members].value_counts().index[0]),
                                                round(float(frame.occupation.iloc[members].value_counts().iloc[0] / len(members)), 3)]},
                    'examples': [{'id': frame.id.iloc[j], 'text': excerpt(frame.iloc[j]),
                                  'source': {'url': frame.source_url.iloc[j], 'licence': 'JobTech CC0'}} for j in nearest]})
    return out


def export_runs(args) -> dict:
    """A run file for every registered run with a saved model on the current text version, then the index."""
    registry, written = Registry('jobs'), []
    import umap
    for run_id, entry in registry.load()['runs'].items():
        folder = jobs_mlops.model_folder(run_id)
        version = entry['run']['pipeline']['text']['version']
        if not folder.exists() or version != ex.TEXTS[entry['run']['pipeline']['text']['variant']][2]:
            continue
        model, manifest = jobs_model.load(folder)
        frame, _ = jobs_data.load(manifest['snapshot_version'])
        train = frame.set_index('id').loc[manifest['train_ids']].reset_index()
        rep = normalise(ex.vectors(train, manifest['pipeline'], transformer=model['transformer'])[0])
        xy = umap.UMAP(n_components=2, n_neighbors=60, min_dist=0.08, metric='cosine', random_state=10).fit_transform(rep)
        points = [[i, x, y, c] for i, (x, y), c in zip(train.id, xy, model['labels'])]
        written.append(str(public.run_file(entry, points, groups(train, model, rep))))
    public.index()
    return {'run_files': written}


def main(argv=None) -> None:
    parser = argparse.ArgumentParser(prog='python -m ml.experiments.jobs')
    parser.add_argument('step', choices=['prepare', 'select', 'final', 'export', 'assign', 'monitor', 'retrain',
                                         'promote', 'rollback'])
    parser.add_argument('--deadline-minutes', type=float)
    parser.add_argument('--store', type=Path, default=jobs_data.STORE)
    parser.add_argument('--hold-out-newest', type=float, default=0.0)
    parser.add_argument('--promote', action='store_true')
    parser.add_argument('--run-id')
    parser.add_argument('--reason', default='')
    parser.add_argument('--copy-to', type=Path)
    args = parser.parse_args(argv)
    args.deadline = Deadline(args.deadline_minutes, margin_minutes=5 if (args.deadline_minutes or 0) < 60 else 30)
    if args.step in ('prepare', 'select', 'final'):
        result = {'prepare': prepare, 'select': select, 'final': final}[args.step](args)
    elif args.step == 'export':
        result = export_runs(args)
    elif args.step == 'assign':
        with heavy_once():
            result = jobs_mlops.assign(args.store)
        set_state(latest=result['snapshot_version'])
    elif args.step == 'monitor':
        files = sorted((OUT / 'monitor').glob('*.json'), key=lambda p: p.stat().st_mtime)
        if not files:
            raise SystemExit('no monitor file yet; run assign or retrain')
        result = read_json(files[-1])
    elif args.step == 'retrain':
        with heavy_once():
            result = jobs_mlops.retrain(state().get('latest') or prepared()[0], promote=args.promote)
    elif args.step == 'promote':
        Registry('jobs').promote(args.run_id, args.reason or 'promoted by hand after a passed acceptance report')
        result = {'champion': args.run_id}
    else:
        if not args.reason:
            raise SystemExit('rollback needs --reason')
        result = {'restored': jobs_mlops.rollback(args.reason, copy_to=args.copy_to)}
    print(json.dumps(result, indent=2, ensure_ascii=False, default=str))


if __name__ == '__main__':
    main()
