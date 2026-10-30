"""Symbol Lab clustering experiments (docs/cluster-experiments.md, docs/cluster-experiments-symbolic.md).

    python -m ml.experiments.symbolic prepare|select|final|export [--deadline-minutes N]

prepare  the champion's sample with duplicates, boilerplate and a leak-checked book split.
select   selection side, seeds 0-2: text variant x model x representation, each over a small
         HDBSCAN grid and a K-means baseline. Writes select.json; nothing here is registered.
final    evaluation side, seeds 10-14: the champion (published v4 pipeline) and CANDIDATES,
         registered, checked against configs/experiments/symbolic.yaml and decided.
export   one public run file per registered run, then the shared index.

select and final checkpoint every finished unit and resume. Promotion in the registry does not
change the published Symbol Lab page; only platform/nlp/symbolic/pipeline.py does.
"""
from __future__ import annotations

import argparse
import json

import numpy as np
import pandas as pd

from ml.cluster_lab.io import atomic_json, atomic_parquet, now, read_json
from . import accept, contract, embed, evaluate as ev, export as ex, fit, runtime
from . import symbolic_data as data
from . import symbolic_fit as sf
from .registry import Registry

DOMAIN = 'symbolic'
QUESTION = ('Which recurring contexts do symbol words share across 101 public-domain books, once book, '
            'tradition and the symbol word itself are accounted for?')
CORPUS = '101 public-domain Project Gutenberg books, 20 symbols with aliases (silver.int_symbol_occurrences)'
MODELS = {'minilm': ('sentence-transformers/all-MiniLM-L6-v2', 'c9745ed1d9f207416be6d2e6f8de32d1f16199bf'),
          'multilingual': ('sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2',
                           'e8f8c211226b894fcb81acc59f3b34ba3efd5f42')}
REDUCTION = {'kind': 'umap', 'dims': 10, 'neighbors': 15, 'min_dist': 0.0, 'metric': 'cosine'}
MAP = {'kind': 'umap', 'dims': 2, 'neighbors': 15, 'min_dist': 0.1, 'metric': 'cosine'}
CHAMPION_CLUSTERING = {'method': 'hdbscan', 'min_cluster_size': 20, 'min_samples': 10}
GRID = {'hdbscan-20-10': CHAMPION_CLUSTERING,
        'hdbscan-20-5': {'method': 'hdbscan', 'min_cluster_size': 20, 'min_samples': 5},
        'hdbscan-50-10': {'method': 'hdbscan', 'min_cluster_size': 50, 'min_samples': 10},
        'hdbscan-100-10': {'method': 'hdbscan', 'min_cluster_size': 100, 'min_samples': 10},
        'hdbscan-50-10-leaf': {'method': 'hdbscan', 'min_cluster_size': 50, 'min_samples': 10, 'selection': 'leaf'},
        'kmeans-30': {'method': 'kmeans', 'k': 30}, 'kmeans-60': {'method': 'kmeans', 'k': 60}}
# (text variant, model, representation) measured on the selection side.
SELECT = [('context', 'minilm', 'raw'), ('context', 'minilm', 'centred'), ('sentence', 'minilm', 'raw'),
          ('masked', 'minilm', 'raw'), ('masked', 'minilm', 'centred'),
          ('context', 'multilingual', 'raw'), ('context', 'multilingual', 'centred')]
SELECT_SEEDS, FINAL_SEEDS = [0, 1, 2], [10, 11, 12, 13, 14]
CHAMPION = ('champion: published v4', 'context', 'minilm', 'raw', 'hdbscan-20-10')
# Chosen from select.json (selection side only); reasons in docs/cluster-experiments-symbolic.md.
CANDIDATES = [('retuned HDBSCAN (mcs 50)', 'context', 'minilm', 'raw', 'hdbscan-50-10'),
              ('masked symbol word, book-centred', 'masked', 'minilm', 'centred', 'hdbscan-20-10'),
              ('multilingual MiniLM, HDBSCAN mcs 100', 'context', 'multilingual', 'raw', 'hdbscan-100-10')]
LIMITATIONS = [
    'Groups are computed context groups of symbol-word occurrences, not universal symbol meanings.',
    'No hand-labelled literal/symbolic sample exists, so no model was fine-tuned and no group is validated.',
    'Group names are generated terms, unreviewed.',
    'Fitted on the evaluation half of the books only; the published map uses all books with seed 42.',
    'English translations dominate; translator wording is part of what a book contributes.',
]


def observations() -> pd.DataFrame:
    if not data.OBSERVATIONS.exists():
        raise SystemExit('run `python -m ml.experiments.symbolic prepare` first')
    return pd.read_parquet(data.OBSERVATIONS)


def vectors(frame: pd.DataFrame, variant: str, model: str, deadline=None) -> np.ndarray:
    name, revision = MODELS[model]
    version = data.VARIANTS[variant]
    texts = data.text_of(frame, variant)
    hashes = [embed.text_hash(t, version) for t in texts]
    return embed.embed(texts, hashes, name, revision, version, deadline=deadline)


def confounders(frame: pd.DataFrame) -> dict:
    return {'book': frame.document_id.to_numpy(), 'tradition': frame.tradition.to_numpy(),
            'symbol': frame.symbol_id.to_numpy()}


def prepare(args) -> None:
    frame = data.with_hashes(data.load())
    with runtime.heavy(wait_seconds=3600), runtime.measure() as used:
        vec = vectors(frame, 'context', 'minilm')
    near = data.near_pairs(vec, frame.document_id.to_numpy())
    mask, split_report = data.split_side(frame, near)
    if split_report['leaks'] or split_report.get('near_identical_pairs_across_sides'):
        raise SystemExit(f"split leaks: {split_report}")
    frame['side'] = np.where(mask, 'selection', 'evaluation')
    atomic_parquet(frame, data.OBSERVATIONS)
    report = {'created_at': now(), 'observations': len(frame), 'books': int(frame.document_id.nunique()),
              'silver': frame.attrs.get('silver'), 'dataset_version': data.version(frame),
              'duplicates': data.duplicates(frame),
              'near_identical': {'threshold': data.NEAR, 'pairs_across_books': int(len(near)),
                                 'rows_involved': int(len(np.unique(near))),
                                 'book_pairs': int(len({tuple(sorted(frame.document_id.iloc[list(p)])) for p in near}))},
              'boilerplate': data.boilerplate(frame), 'split': split_report, 'embedding_resources': used}
    atomic_json(data.FOLDER / 'prepare.json', report)
    print(json.dumps(report, indent=1))


def select(args) -> None:
    frame = observations()
    side = frame[frame.side == 'selection'].reset_index(drop=True)
    deadline, marks = runtime.Deadline(args.deadline_minutes), runtime.Checkpoints(data.RESULTS / 'select')
    conf = confounders(side)
    for text, model, rep in SELECT:
        key = f'{text}-{model}-{rep}'
        if marks.done(key):
            continue
        if deadline.expired():
            print('deadline reached; rerun to resume')
            return
        with runtime.heavy(wait_seconds=3600), runtime.measure() as used:
            vec = vectors(side, text, model, deadline)
            grid = sf.fit_grid(vec, {'kind': rep}, REDUCTION, GRID, SELECT_SEEDS, conf, side.document_id)
            neighbours = {f: ev.neighbour_share(grid['_rep'], v) for f, v in conf.items()}
            texts = side.context.tolist()
            rows = {}
            for name, spec in GRID.items():
                labels, metrics = grid[name]
                metrics['book_specific_terms'] = sf.terms(texts, labels, side.document_id.to_numpy())[1]
                rows[name] = metrics
        marks.put(key, {'text': text, 'model': model, 'representation': rep, 'neighbours': neighbours,
                        'clusterings': rows, 'resources': used})
        print(key, used, flush=True)
    atomic_json(data.RESULTS / 'select.json', {'created_at': now(), 'seeds': SELECT_SEEDS, 'n': len(side),
                                              'results': marks.all()})


def pipeline_of(text: str, model: str, rep: str, clustering: str) -> dict:
    name, revision = MODELS[model]
    return {'text': {'unit': 'matching sentence' if text == 'sentence' else 'previous + matching + next sentence',
                     'variant': text, 'version': data.VARIANTS[text]},
            'embedding': {'model': name, 'revision': revision},
            'representation': {'kind': rep, 'groups': 'document_id' if rep == 'centred' else None},
            'reduction': REDUCTION, 'clustering': GRID[clustering], 'map': '2-D UMAP of the representation, n15 md0.1'}


def final(args) -> None:
    frame = observations()
    side = frame[frame.side == 'evaluation'].reset_index(drop=True)
    version = data.version(side)
    deadline, marks = runtime.Deadline(args.deadline_minutes), runtime.Checkpoints(data.RESULTS / 'final')
    registry, (rules, sha) = Registry(DOMAIN), accept.criteria(DOMAIN)
    conf = confounders(side)
    for label, text, model, rep, clustering in [CHAMPION, *CANDIDATES]:
        key = f'{text}-{model}-{rep}-{clustering}'
        if not marks.done(key):
            if deadline.expired():
                print('deadline reached; rerun to resume')
                return
            with runtime.heavy(wait_seconds=3600), runtime.measure() as used:
                vec = vectors(side, text, model, deadline)
                grid = sf.fit_grid(vec, {'kind': rep}, REDUCTION, {clustering: GRID[clustering]}, FINAL_SEEDS,
                                   conf, side.document_id)
                labels, metrics = grid[clustering]
                metrics['neighbours'] = {f: ev.neighbour_share(grid['_rep'], v) for f, v in conf.items()}
                metrics['book_specific_terms'] = sf.terms(side.context.tolist(), labels, side.document_id.to_numpy())[1]
            np.save(marks.folder / f'{key}.space.npy', grid['_space'])
            marks.put(key, {'metrics': metrics, 'labels': labels.tolist(), 'resources': used})
            print(key, used, flush=True)
        done = marks.get(key)
        pipe = pipeline_of(text, model, rep, clustering)
        run = {'domain': DOMAIN, 'question': QUESTION, 'corpus': CORPUS, 'label': label,
               'sample': {'strategy': f'at most {data.PER_PAIR} per book and symbol, lowest occurrence ids, '
                                      'reprints (duplicate_of) left out', 'side': 'evaluation',
                          'split_seed': data.SPLIT_SEED, 'observations': len(side),
                          'books': int(side.document_id.nunique())},
               'dataset_version': version, 'pipeline': pipe, 'seeds': FINAL_SEEDS, 'role': 'evaluation',
               'metrics': done['metrics'], 'resources': done['resources'], 'limitations': LIMITATIONS,
               'created_at': now()}
        run['run_id'] = contract.run_id(DOMAIN, version, pipe, FINAL_SEEDS, 'evaluation')
        atomic_json(marks.folder / 'runs' / f"{run['run_id']}.json", {'key': key, 'label': label, 'text': text, 'model': model,
                                                                              'representation': rep})
        if label == CHAMPION[0]:
            registry.register(run, 'champion', 'published v4 pipeline refitted on the evaluation side')
            champion = run
            continue
        entry = registry.register(run, 'candidate', 'chosen on the selection side')
        if entry['status'] == 'candidate' and 'acceptance' not in entry:
            # Every candidate is judged against the refitted v4 run; only the first to pass, in
            # CANDIDATES order, is promoted.
            report = accept.check(run, champion, rules, sha)
            status = registry.decide(run['run_id'], report)
            print(label, status, report['failed'])
            if report['passed'] and registry.champion()['run_id'] == champion['run_id']:
                registry.promote(run['run_id'], 'met every frozen criterion on the evaluation side')
    state = registry.load()
    print(json.dumps({r: {'status': e['status'], 'label': e['run'].get('label'),
                          'failed': (e.get('acceptance') or {}).get('failed')} for r, e in state['runs'].items()},
                     indent=1))


def export(args) -> None:
    frame = observations()
    side = frame[frame.side == 'evaluation'].reset_index(drop=True)
    folder = data.RESULTS / 'final'
    for run_id, entry in Registry(DOMAIN).load()['runs'].items():
        pointer = folder / 'runs' / f'{run_id}.json'
        if not pointer.exists():
            continue
        point = read_json(pointer)
        key, text, model, rep = point['key'], point['text'], point['model'], point['representation']
        done = read_json(folder / f'{key}.json')
        labels, space = np.asarray(done['labels']), np.load(folder / f'{key}.space.npy')
        with runtime.heavy(wait_seconds=3600):
            xy = fit.reduce(fit.represent(vectors(side, text, model), rep, side.document_id), MAP, FINAL_SEEDS[0])
        terms, _ = sf.terms(side.context.tolist(), labels, side.document_id.to_numpy())
        ex.run_file(entry, [[i, x, y, c] for i, (x, y), c in zip(side.occurrence_id, xy, labels)],
                    groups_of(side, labels, space, terms))
        print('exported', run_id, entry['status'])
    print(ex.index())


def groups_of(side: pd.DataFrame, labels: np.ndarray, space: np.ndarray, terms: dict) -> list[dict]:
    groups = []
    for c in sorted(set(labels[labels >= 0])):
        members = side[labels == c]
        book, symbol = members.document_id.value_counts(), members.symbol_id.value_counts()
        title = members.title[members.document_id == book.index[0]].iloc[0]
        nearest, border = sf.examples(space, labels, c)

        def item(i: int, role: str) -> dict:
            row = side.iloc[i]
            return {'id': row.occurrence_id, 'role': role, 'text': row.context,
                    'source': {'book': row.title, 'author': row.author, 'symbol': row.symbol_id}}

        groups.append({'cluster': int(c), 'size': int(len(members)),
                       'dominant': {'book': [title, round(float(book.iloc[0] / len(members)), 3)],
                                    'symbol': [symbol.index[0], round(float(symbol.iloc[0] / len(members)), 3)]},
                       'terms': terms.get(int(c), []), 'name_status': 'generated terms, unreviewed',
                       'examples': [item(i, 'representative') for i in nearest]
                       + ([item(border, 'borderline')] if border is not None else [])})
    return groups


def main(argv=None) -> None:
    parser = argparse.ArgumentParser(prog='python -m ml.experiments.symbolic')
    parser.add_argument('command', choices=['prepare', 'select', 'final', 'export'])
    parser.add_argument('--deadline-minutes', type=float, default=None)
    args = parser.parse_args(argv)
    {'prepare': prepare, 'select': select, 'final': final, 'export': export}[args.command](args)


if __name__ == '__main__':
    main()
