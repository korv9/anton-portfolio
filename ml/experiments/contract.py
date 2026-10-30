"""The run record every domain writes, and its check.

A run is one fitted clustering: a question asked of a dataset version, a pipeline (text, embedding,
representation, reduction, clustering) and the seeds it ran with. Its id is a hash of exactly those,
so the same inputs give the same id and any change gives a new one. Cluster ids are only meaningful
inside their run; `cluster_key` names a group as `<run_id>:<cluster>`.
"""
from __future__ import annotations

from ml.cluster_lab.io import digest

DOMAINS = ('philosophy', 'symbolic', 'jobs', 'debates')
STATUSES = ('candidate', 'champion', 'rejected')
ROLES = ('selection', 'evaluation', 'full')
# What a run must say about itself before it may be registered or exported.
REQUIRED = {
    'domain': str, 'question': str, 'corpus': str, 'sample': dict, 'dataset_version': str,
    'pipeline': dict, 'seeds': list, 'role': str, 'metrics': dict, 'resources': dict,
    'limitations': list, 'created_at': str,
}
PIPELINE = ('text', 'embedding', 'representation', 'reduction', 'clustering')


def run_id(domain: str, dataset_version: str, pipeline: dict, seeds: list, role: str) -> str:
    """Stable id of a run: same inputs, same id."""
    return digest({'domain': domain, 'dataset': dataset_version, 'pipeline': pipeline,
                   'seeds': sorted(seeds), 'role': role})[:16]


def cluster_key(run: str, cluster: int) -> str | None:
    """A group's name outside its run. Noise (-1) has none."""
    return None if cluster < 0 else f'{run}:{cluster}'


def validate(run: dict) -> list[str]:
    """Problems with a run record; an empty list means it may be registered."""
    problems = [f'missing {key}' for key in REQUIRED if key not in run]
    problems += [f'{key} is not {kind.__name__}' for key, kind in REQUIRED.items()
                 if key in run and not isinstance(run[key], kind)]
    if problems:
        return problems
    if run['domain'] not in DOMAINS:
        problems.append(f"unknown domain {run['domain']}")
    if run['role'] not in ROLES:
        problems.append(f"unknown role {run['role']}")
    problems += [f'pipeline lacks {part}' for part in PIPELINE if part not in run['pipeline']]
    embedding = run['pipeline'].get('embedding', {})
    if isinstance(embedding, dict) and embedding.get('model') and not embedding.get('revision'):
        problems.append('embedding model has no pinned revision')
    if not run['seeds']:
        problems.append('no seeds')
    expected = run_id(run['domain'], run['dataset_version'], run['pipeline'], run['seeds'], run['role'])
    if run.get('run_id') != expected:
        problems.append(f"run_id {run.get('run_id')} does not match its inputs ({expected})")
    for key in ('noise_share', 'cluster_count'):
        if key not in run['metrics']:
            problems.append(f'metrics lack {key}')
    if not run['limitations']:
        problems.append('a run states at least one limitation')
    return problems
