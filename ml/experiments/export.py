"""Public files for Cluster Visuals: an index of every registered run and one file per run.

    frontend/public/data/cluster-experiments/index.json
    frontend/public/data/cluster-experiments/runs/<run_id>.json

The index is small and loads first; a run's file (map points, groups, examples) loads when it is
opened. Every run file names its status, its limitations and the champion it was compared with.
Coordinates belong to one run: maps of different runs are separate UMAP fits and are not aligned.

`run_file` takes what a domain computed: the registry entry, the 2-D points and the groups with
their examples. Example texts are cut to EXCERPT characters; a domain passes only texts that may
be published (the same public sources its own page already shows).
"""
from __future__ import annotations

from pathlib import Path

import yaml

from ml.cluster_lab.io import atomic_json, now, read_json
from .contract import DOMAINS
from .registry import EXPERIMENTS, REPRO, Registry

SITE = Path(__file__).resolve().parents[2] / 'frontend' / 'public' / 'data' / 'cluster-experiments'
# A reproduction exports beside its own registry, never into the site's files.
OUT = EXPERIMENTS / 'export' if REPRO else SITE
EXCERPT = 300
MAX_POINTS = 3000
SCHEMA_VERSION = 1
SITE_PAGES = ('philosophy', 'symbolic', 'debates')
# Reproduction notes per run (configs/experiments/reproduction.yaml), shown with its limitations.
NOTES = Path(__file__).resolve().parents[2] / 'configs' / 'experiments' / 'reproduction.yaml'
NOTE_PREFIX = 'CPU rerun: '
COORDINATES = ('Coordinates come from this run\'s own 2-D UMAP fit. Maps of different runs are not '
               'aligned, so a position or a movement between two maps means nothing.')


def excerpt(text: str) -> str:
    text = ' '.join(str(text).split())
    return text if len(text) <= EXCERPT else text[:EXCERPT - 1].rsplit(' ', 1)[0] + '…'


def run_file(entry: dict, points: list[list], groups: list[dict], out: Path = OUT) -> Path:
    """points: [[observation_id, x, y, cluster]] (sampled to MAX_POINTS by the caller or here).
    groups: [{cluster, size, terms?, dominant?: {field: [value, share]}, examples: [{id, text, source}]}]."""
    run = entry['run']
    if len(points) > MAX_POINTS:
        step = len(points) / MAX_POINTS
        points = [points[int(i * step)] for i in range(MAX_POINTS)]
    body = {
        'schema_version': SCHEMA_VERSION,
        'run_id': run['run_id'],
        'status': entry['status'],
        'acceptance': entry.get('acceptance'),
        'run': {k: v for k, v in run.items() if k not in ('labels',)},
        'map': {'method': run['pipeline'].get('map', '2-D UMAP of the representation'), 'note': COORDINATES,
                'columns': ['id', 'x', 'y', 'cluster'],
                'points': [[str(p[0]), round(float(p[1]), 3), round(float(p[2]), 3), int(p[3])] for p in points]},
        'groups': [{**g, 'key': f"{run['run_id']}:{g['cluster']}",
                    'name_status': g.get('name_status', 'unnamed'),
                    'examples': [{**e, 'text': excerpt(e['text'])} for e in g.get('examples', [])]}
                   for g in groups],
    }
    path = out / 'runs' / f"{run['run_id']}.json"
    atomic_json(path, body)
    return path


def index(out: Path = OUT, root: Path | None = None) -> Path:
    """Rebuild index.json from every domain registry; only runs with a written run file are listed."""
    domains, notes = {}, yaml.safe_load(NOTES.read_text(encoding='utf-8')) if NOTES.exists() else {}
    for domain in DOMAINS:
        state = Registry(domain, root).load()
        runs = []
        for run_id, entry in state['runs'].items():
            file = out / 'runs' / f'{run_id}.json'
            if not file.exists():
                continue
            # A status changed after export (promotion, rollback) is written into the run file too.
            # The run registered as the first champion is the pipeline the site page publishes; a
            # registry promotion does not change that page, so the file says so.
            # Job-ad groups have no site page yet: the research summary on #jobs is another corpus.
            on_site = domain in SITE_PAGES and any(
                h['run_id'] == run_id and h['action'] == 'register:champion' for h in state['history'])
            sync = {'status': entry['status'], 'acceptance': entry.get('acceptance'),
                    'published_on_site_page': on_site, 'retired_at': entry.get('retired_at')}
            body = read_json(file)
            note = (notes.get(domain) or {}).get(run_id)
            kept = [t for t in body['run'].get('limitations', []) if not t.startswith(NOTE_PREFIX)]
            sync['run'] = {**body['run'], 'limitations': [*kept, *([NOTE_PREFIX + note] if note else [])]}
            if any(body.get(k) != v for k, v in sync.items()):
                atomic_json(file, {**body, **sync})
            run, m = entry['run'], entry['run']['metrics']
            runs.append({'run_id': run_id, 'status': entry['status'], 'label': run.get('label', run_id),
                         'role': run['role'], 'created_at': run['created_at'],
                         'dataset_version': run['dataset_version'],
                         'embedding': run['pipeline']['embedding'], 'clustering': run['pipeline']['clustering'],
                         'cluster_count': m['cluster_count'], 'noise_share': m['noise_share'],
                         'seed_ari': (m.get('seed_stability') or {}).get('ari_mean'),
                         'accepted': (entry.get('acceptance') or {}).get('passed'),
                         'published_on_site_page': on_site, 'retired_at': entry.get('retired_at')})
        if runs:
            champion = next((r['run_id'] for r in runs if r['status'] == 'champion'), None)
            question = state['runs'][champion or runs[0]['run_id']]['run']['question']
            domains[domain] = {'champion': champion, 'question': question,
                               'runs': sorted(runs, key=lambda r: (r['status'] != 'champion', r['created_at']))}
    path = out / 'index.json'
    atomic_json(path, {'schema_version': SCHEMA_VERSION, 'generated_at': now(), 'coordinates': COORDINATES,
                       'domains': domains})
    if out == SITE:
        # The site's catalogue lists every delivered file with its hash; only these entries change.
        from portfolio.publish.catalog import register
        register([path, *sorted((out / 'runs').glob('*.json'))])
    return path
