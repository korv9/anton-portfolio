"""Run with python -m ml.jobs.pipeline; never publishes or uploads automatically."""
from __future__ import annotations

import argparse
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path

from .prepare import load_jobs, TEXT_VERSION
from .embeddings import embed, DEFAULT_MODEL, REPRESENTATION
from .reduce import reduce
from .cluster import cluster
from .profile import profiles, sql_profiles
from .evaluate import evaluate

ROOT = Path(__file__).resolve().parents[2]


@dataclass
class Config:
    model: str = DEFAULT_MODEL
    revision: str | None = None
    neighbors: int = 60
    dimensions: int = 10
    min_cluster_size: int = 100
    min_samples: int = 3
    selection_method: str = 'eom'
    cluster_min_dist: float = 0.
    visual_min_dist: float = .08
    seed: int = 42
    batch_size: int = 32
    limit: int | None = None
    feature_recipe: str = 'balanced'
    assignment_method: str = 'seed-consensus'


def validate_output(jobs):
    import numpy as np
    if jobs.job_id.isna().any() or jobs.job_id.duplicated().any():
        raise ValueError('Assignments require unique nonnull job_id')
    if not np.isfinite(jobs[['umap_x', 'umap_y', 'cluster_probability']].to_numpy()).all():
        raise ValueError('Coordinates and probabilities must be finite')
    if not jobs.cluster_probability.between(0, 1).all():
        raise ValueError('Cluster probabilities must be in [0, 1]')
    if not (jobs.is_noise == (jobs.cluster_id == -1)).all():
        raise ValueError('Noise must correspond to cluster_id = -1')


def run(database: Path, directory: Path, config: Config, compare=False, sweep_candidate: Path | None = None,
        feature_candidate: Path | None = None):
    import duckdb
    import importlib.metadata
    import pandas as pd
    import numpy as np
    from huggingface_hub import model_info

    jobs, source_size = load_jobs(database, config.limit)
    # Resolve the model commit before cache lookup; a moved default revision cannot
    # silently reuse embeddings from different weights.
    config.revision = model_info(config.model, revision=config.revision).sha
    sweep = None
    if sweep_candidate:
        if config.feature_recipe != 'baseline' or config.assignment_method != 'hdbscan':
            raise ValueError('The embedding-only sweep cannot validate engineered features or consensus')
        from .sweep import analysis_metadata_sha
        result = json.loads(sweep_candidate.read_text(encoding='utf-8'))
        search = json.loads((sweep_candidate.parent / 'report.json').read_text(encoding='utf-8'))
        reviewed = json.loads(sweep_candidate.with_name(sweep_candidate.stem + '-review.json').read_text(encoding='utf-8'))
        inputs = pd.read_parquet(sweep_candidate.parent / 'inputs.parquet')
        with duckdb.connect(str(database), read_only=True) as con:
            lookup = dict(con.execute('select job_id, employer_name from silver.int_job_ads_enriched').fetchall())
        employers = np.asarray([str(lookup.get(jid) or '').strip() for jid in jobs.job_id])
        metadata_sha = analysis_metadata_sha(jobs, employers)
        keys = ('neighbors', 'dimensions', 'cluster_min_dist', 'min_cluster_size', 'min_samples', 'selection_method', 'seed')
        if (any(result[k] != getattr(config, k) for k in keys)
                or search['revision'] != config.revision or search['model'] != config.model
                or not inputs.equals(jobs[['job_id', 'text_hash']])
                or reviewed['candidate'] != result
                or search['analysis_metadata_sha'] != metadata_sha
                or reviewed['analysis_metadata_sha'] != metadata_sha
                or any(importlib.metadata.version(p) != version for p, version in search['versions'].items())
                or result not in search['candidates']):
            raise ValueError('Sweep selection does not match this corpus, model, parameters or review')
        sweep = {'candidate_count': len(search['candidates']), 'diagnostic_sample_size': search['diagnostic_sample_size'],
                 'selected': result, 'seed_stability': reviewed['stability'], 'selection_note': search['selection_note']}
    with duckdb.connect(str(database), read_only=True) as con:
        coverage = [{'month': str(month), 'status': status, 'url': url, 'sha256': digest}
                    for month, status, url, digest in con.execute('select publication_month, status, source_uri, source_sha256 from raw.collection_coverage order by publication_month').fetchall()]
        candidate_count = con.execute('select count(*) from silver.int_job_ads_enriched').fetchone()[0]
    print(f'Source: {source_size}; analysis: {len(jobs)}', flush=True)
    embeddings, cache = embed(jobs, directory, config.model, config.revision, config.batch_size)
    representation_matrix = embeddings
    feature_ensemble = None
    if config.feature_recipe != 'baseline' or feature_candidate:
        from .features import build_blocks, fuse, RECIPES, DEFAULT_MODEL as FEATURE_MODEL
        if config.model != FEATURE_MODEL:
            raise ValueError('Feature recipes require their documented pinned multilingual model')
        blocks, feature_report, feature_folder = build_blocks(jobs, directory, config.revision)
        representation_matrix = blocks['raw'] if config.feature_recipe == 'baseline' else fuse(blocks, RECIPES[config.feature_recipe])
        feature_ensemble = {'version': feature_report['version'], 'feature_id': feature_folder.name,
                            'recipe': config.feature_recipe, 'weights': RECIPES[config.feature_recipe],
                            'block_dimensions': feature_report['block_dimensions'],
                            'feature_dimensions': representation_matrix.shape[1],
                            'assignment_method': config.assignment_method,
                            'cleanup': {k: feature_report[k] for k in ('ads_with_removed_segments', 'original_characters', 'clean_characters', 'skill_missing_share')}}
        if feature_candidate:
            from .sweep import analysis_metadata_sha
            selected = json.loads(feature_candidate.read_text(encoding='utf-8'))
            experiment = json.loads((feature_candidate.parent / 'report.json').read_text(encoding='utf-8'))
            reviewed = json.loads(feature_candidate.with_name(feature_candidate.stem + '-review.json').read_text(encoding='utf-8'))
            with duckdb.connect(str(database), read_only=True) as con:
                lookup = dict(con.execute('select job_id, employer_name from silver.int_job_ads_enriched').fetchall())
            employers = np.asarray([str(lookup.get(jid) or '').strip() for jid in jobs.job_id])
            keys = ('neighbors', 'dimensions', 'cluster_min_dist', 'min_cluster_size', 'min_samples', 'selection_method', 'seed')
            if (selected['recipe'] != config.feature_recipe
                    or any(selected[k] != getattr(config, k) for k in keys)
                    or experiment['revision'] != config.revision
                    or not pd.read_parquet(feature_candidate.parent / 'inputs.parquet').equals(jobs[['job_id', 'text_hash']])
                    or experiment['analysis_metadata_sha'] != analysis_metadata_sha(jobs, employers)
                    or reviewed['analysis_metadata_sha'] != experiment['analysis_metadata_sha']
                    or reviewed['feature_id'] != feature_folder.name or reviewed['candidate'] != selected
                    or any(importlib.metadata.version(p) != version for p, version in experiment['versions'].items())
                    or selected not in experiment['candidates']):
                raise ValueError('Feature selection does not match corpus, features, model, parameters or review')
            feature_ensemble.update({'candidate_count': len(experiment['candidates']),
                                     'diagnostic_sample_size': experiment['diagnostic_sample_size'],
                                     'selected': selected, 'seed_stability': reviewed['stability'],
                                     'consensus_window_stability': reviewed.get('consensus_window_stability', []),
                                     'consensus_metrics': reviewed['consensus']})
    space, visual = reduce(representation_matrix, config.neighbors, config.dimensions, config.seed, config.cluster_min_dist, config.visual_min_dist)
    labels, probabilities = cluster(space, config.min_cluster_size, config.min_samples, config.selection_method)
    if config.assignment_method == 'seed-consensus':
        from .feature_experiment import fit, consensus
        if config.cluster_min_dist != 0.:
            raise ValueError('Consensus fits require cluster min-dist 0')
        label_sets = [labels]
        fit_config = {'recipe': config.feature_recipe, **asdict(config)}
        identity = '\n'.join(jobs.job_id + ':' + jobs.text_hash) + str(feature_ensemble) + json.dumps(asdict(config), sort_keys=True)
        identity += json.dumps({p: importlib.metadata.version(p) for p in ('umap-learn', 'hdbscan', 'scikit-learn')}, sort_keys=True)
        folder = feature_candidate.parent if feature_candidate else directory / 'consensus' / hashlib.sha256(identity.encode()).hexdigest()[:16]
        folder.mkdir(parents=True, exist_ok=True)
        for seed in [config.seed + 1, config.seed + 2]:
            _, alternate, _ = fit(representation_matrix, fit_config, folder, seed)
            label_sets.append(alternate)
        labels, probabilities = consensus(label_sets)
    if feature_candidate:
        target = feature_candidate.with_name(feature_candidate.stem + '-consensus.npz') if config.assignment_method == 'seed-consensus' else feature_candidate.with_suffix('.npz')
        expected = np.load(target)
        if not np.array_equal(labels, expected['labels']) or not np.allclose(probabilities, expected['probabilities']):
            raise ValueError('Recomputed assignments differ from reviewed feature candidate')
    if sweep_candidate:
        expected = np.load(sweep_candidate.with_suffix('.npz'))
        if not np.array_equal(labels, expected['labels']) or not np.allclose(probabilities, expected['probabilities']):
            raise ValueError('Recomputed assignments differ from the reviewed sweep candidate')
    jobs['cluster_id'], jobs['cluster_probability'] = labels, probabilities
    jobs['is_noise'] = labels == -1
    jobs['umap_x'], jobs['umap_y'] = visual[:, 0], visual[:, 1]
    validate_output(jobs)
    diagnostics = evaluate(embeddings, space, visual, labels, probabilities, jobs, config.seed,
                           feature_vectors=representation_matrix if feature_ensemble else None)
    from .sweep import structure
    from sklearn.metrics import silhouette_score
    with duckdb.connect(str(database), read_only=True) as con:
        lookup = dict(con.execute('select job_id, employer_name from silver.int_job_ads_enriched').fetchall())
    employers = np.asarray([str(lookup.get(jid) or '').strip() for jid in jobs.job_id])
    diagnostics.update({k: v for k, v in structure(labels, employers).items() if k != 'cluster_sizes'})
    diagnostics['membership_kind'] = 'fraction of aligned seed fits agreeing (not a calibrated probability)' if config.assignment_method == 'seed-consensus' else 'HDBSCAN membership (not a calibrated label probability)'
    if feature_ensemble:
        indices = np.flatnonzero(labels != -1)
        if len(indices) > 1500:
            indices = np.sort(np.random.default_rng(config.seed).choice(indices, 1500, replace=False))
        diagnostics['feature_silhouette'] = float(silhouette_score(representation_matrix[indices], labels[indices], metric='cosine')) if 1 < len(set(labels[indices])) < len(indices) else None
        diagnostics['feature_silhouette_space'] = 'engineered feature vectors, cosine; noise excluded'
    comparisons = []
    if compare:
        for neighbors, size in [(max(5, config.neighbors // 2), config.min_cluster_size), (config.neighbors, max(2, config.min_cluster_size // 2))]:
            alternate, coords = reduce(representation_matrix, neighbors, config.dimensions, config.seed, config.cluster_min_dist, config.visual_min_dist)
            ids, probs = cluster(alternate, size, config.min_samples, config.selection_method)
            other = jobs.assign(cluster_id=ids)
            comparisons.append({'neighbors': neighbors, 'min_cluster_size': size,
                                'assignment_method': 'hdbscan',
                                'diagnostics': evaluate(embeddings, alternate, coords, ids, probs, other, config.seed)})
    cluster_profiles = profiles(jobs)
    versions = {package: importlib.metadata.version(package) for package in ['sentence-transformers', 'umap-learn', 'hdbscan', 'numpy', 'scikit-learn', 'duckdb']}
    # Input metadata and package versions also identify a run: the same text can
    # acquire a corrected year/role/region without changing its cached embedding.
    metadata = jobs[['job_id', 'role_family', 'seniority', 'published_year', 'region', 'skills']].to_json(orient='records')
    implementation_sha = hashlib.sha256(b''.join(p.read_bytes() for p in sorted(Path(__file__).parent.glob('*.py')))).hexdigest()
    signature = hashlib.sha256(('\n'.join(jobs.job_id + ':' + jobs.text_hash) + metadata + json.dumps(asdict(config), sort_keys=True) + REPRESENTATION + json.dumps(versions, sort_keys=True) + implementation_sha + str(compare) + json.dumps(coverage, sort_keys=True) + json.dumps(sweep, sort_keys=True) + json.dumps(feature_ensemble, sort_keys=True)).encode()).hexdigest()
    run_id = signature[:16]
    folder = directory / 'runs' / run_id
    folder.mkdir(parents=True, exist_ok=True)
    assignments = jobs[['job_id', 'cluster_id', 'cluster_probability', 'is_noise', 'umap_x', 'umap_y']].assign(run_id=run_id)
    assignments.to_parquet(folder / 'assignments.parquet', index=False)
    profile_frame = sql_profiles(cluster_profiles).assign(run_id=run_id)
    profile_frame.to_parquet(folder / 'profiles.parquet', index=False)
    report = {'schema_version': 1, 'run_id': run_id, 'generated_at': datetime.now(timezone.utc).isoformat(),
              'source': 'silver.int_job_ads_enriched + gold.bridge_job_skills', 'source_size': source_size,
              'sampled': source_size != len(jobs), 'source_kinds': sorted(set(jobs.source_kind)),
              'coverage': coverage, 'candidate_count': candidate_count,
              'unique_text_count': int(jobs.text_hash.nunique()),
              'implementation_sha': implementation_sha,
              'config': asdict(config), 'text_version': TEXT_VERSION, 'representation': REPRESENTATION,
              'cache': cache, 'diagnostics': diagnostics, 'parameter_comparisons': comparisons,
              'parameter_sweep': sweep,
              'feature_ensemble': feature_ensemble,
              'versions': versions}
    (folder / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2, allow_nan=False), encoding='utf-8')
    # ML results enter raw as a source. dbt owns silver/gold; delivery reads only gold.
    run_frame = pd.DataFrame([{'run_id': run_id, 'report_json': json.dumps(report, allow_nan=False)}])
    with duckdb.connect(str(database)) as con:
        con.execute('begin')
        try:
            con.execute('create schema if not exists raw')
            for name, frame in [('job_cluster_assignments', assignments), ('job_cluster_profiles', profile_frame), ('job_cluster_runs', run_frame)]:
                con.register('ml_result', frame)
                con.execute(f'create or replace table raw.{name} as select * from ml_result')
                con.unregister('ml_result')
            con.execute('commit')
        except Exception:
            con.execute('rollback')
            raise
    print(json.dumps(diagnostics, indent=2), flush=True)
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--database', type=Path, default=Path(os.getenv('ML_JOBS_DB', ROOT / 'warehouse/jobtech/history.duckdb')))
    parser.add_argument('--output', type=Path, default=ROOT / 'warehouse/ml/jobs')
    for field in Config.__dataclass_fields__.values():
        parser.add_argument('--' + field.name.replace('_', '-'), default=field.default,
                            type=str if field.name in ('model', 'revision', 'selection_method', 'feature_recipe', 'assignment_method') else float if field.name.endswith('min_dist') else int)
    parser.add_argument('--compare', action='store_true')
    parser.add_argument('--sweep-candidate', type=Path, help='Reviewed sweep candidate JSON matching these parameters')
    parser.add_argument('--feature-candidate', type=Path, help='Reviewed feature experiment candidate matching these parameters')
    args = parser.parse_args()
    config = Config(**{key: getattr(args, key) for key in Config.__dataclass_fields__})
    if config.neighbors < 2 or config.dimensions < 3 or config.min_samples < 1 or config.batch_size < 1 or (config.limit is not None and config.limit < 20):
        parser.error('Require neighbors >= 2, dimensions >= 3, positive min-samples/batch-size and limit >= 20')
    if config.selection_method not in ('eom', 'leaf') or not 0 <= config.cluster_min_dist <= 1 or not 0 <= config.visual_min_dist <= 1:
        parser.error('Require eom/leaf selection and min-dist between 0 and 1')
    from .features import RECIPES
    if config.feature_recipe not in RECIPES or config.assignment_method not in ('hdbscan', 'seed-consensus'):
        parser.error('Require a documented feature recipe and hdbscan/seed-consensus assignment')
    if args.sweep_candidate and args.feature_candidate:
        parser.error('Select one experiment provenance source')
    run(args.database, args.output, config, args.compare, args.sweep_candidate, args.feature_candidate)


if __name__ == '__main__':
    main()
