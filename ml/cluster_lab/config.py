"""Strict YAML configuration, finite candidate domains and dotted overrides."""
from __future__ import annotations

from copy import deepcopy
from datetime import date
import math
from pathlib import Path

import yaml

DEFAULTS = {
    'schema_version': 1,
    'output': 'warehouse/cluster_lab', 'cache': 'warehouse/cluster_lab/cache',
    'datasets': [],
    'representation': {'kind': 'embedding', 'text_fields': ['title', 'description'],
        'title_weight': 1, 'preprocessing': 'raw', 'mask_symbol': False,
        'model': 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2',
        'revision': 'e8f8c211226b894fcb81acc59f3b34ba3efd5f42', 'device': 'cpu',
        'batch_size': 32, 'normalize': True, 'centering': 'none', 'centering_strength': 1.0,
        'author_min_observations': 5, 'author_min_works': 2,
        'svd_dimensions': 128, 'max_features': 20000, 'metadata_features': [], 'storage_dtype': 'float32'},
    'reduction': {'method': 'umap', 'n_neighbors': 30, 'n_components': 10,
        'min_dist': 0.05, 'metric': 'cosine', 'init': 'random', 'n_epochs': None,
        'pre_pca_components': None, 'pca_batch_size': 2048},
    'clustering': {'method': 'hdbscan', 'implementation': 'hdbscan',
        'min_cluster_size': 50, 'min_samples': 10, 'cluster_selection_method': 'eom',
        'metric': 'euclidean', 'cluster_selection_epsilon': 0.0,
        'n_clusters': 30, 'batch_size': 2048},
    'seed': 42, 'sample_size': None, 'sample_seed': 42,
    'sweep': {'coarse_candidates': 12, 'sample_sizes': [20000, 60000], 'finalists': 3,
        'refinements_per_finalist': 2, 'stability_seeds': [43, 44],
        'stability_sample_seeds': [43], 'full_seeds': [42, 43],
        'min_cluster_size_factors': [0.7, 1.4], 'search': [], 'baseline': {},
        'full_representation_limit': None,
        'full_allowed': [],
        'selection': {'noise_weight': 0.3, 'largest_weight': 0.4, 'dominance_weight': 0.2,
                      'silhouette_weight': 1.0, 'min_clusters': 2}},
    'evaluation': {'sample_size': 1200, 'seed': 1729, 'silhouette_metric': 'cosine',
        'examples': 5, 'terms': 12, 'profile_max_features': 20000,
        'profile_sample_per_cluster': 300, 'centroid_sample_per_cluster': 10000,
        'profile_total_term_samples': 100000,
        'duplicate_sample_size': 3000, 'duplicate_similarity': 0.96, 'profile_stop_words': 'auto'},
    'layouts': {'count': 8, 'n_neighbors': [10, 30, 60, 120],
        'min_dist': [0.0, 0.05, 0.15, 0.35, 0.6], 'seeds': [42, 43],
        'metric': 'cosine', 'spread': 1.0, 'repulsion_strength': 1.0,
        'n_epochs': None, 'trust_sample_size': 1200, 'trust_neighbors': 10,
        'preview_points': 30000, 'preview_count': 8, 'display_seed': 1729,
        'point_size': 1.4, 'alpha': 0.35, 'neighbor_lines': 0, 'density_contours': False,
        'feature_source': 'representation'},
    'resources': {'cpu_threads': 4, 'workers': 1, 'memory_gb': 10, 'min_free_disk_gb': 2,
        'duckdb_memory_gb': 1.5, 'max_spill_gb': 2, 'spill_directory': 'warehouse/cluster_lab/spill',
        'torch_threads': 2, 'embedding_checkpoint_rows': 256, 'text_vector_cache_rows': 300000},
}
DATA_KEYS = {'name', 'adapter', 'database', 'path', 'raw', 'family', 'symbol',
    'start', 'end', 'as_of', 'min_occurrences', 'min_works', 'max_symbols',
    'include_reprints', 'allow_partial', 'representation', 'sweep', 'clustering',
    'reduction', 'prepare', 'corpus', 'archives', 'current_snapshot', 'ingestion', 'source_archives', 'manifest', 'layouts'}


def merge(base, patch):
    out = deepcopy(base)
    for key, value in patch.items():
        if isinstance(value, dict) and isinstance(out.get(key), dict):
            out[key] = merge(out[key], value)
        else:
            out[key] = deepcopy(value)
    return out


def set_value(config, dotted, value):
    parts = dotted.split('.')
    target = config
    for part in parts[:-1]:
        if part not in target or not isinstance(target[part], dict):
            raise ValueError(f'Unknown configuration path: {dotted}')
        target = target[part]
    if parts[-1] not in target:
        raise ValueError(f'Unknown configuration key: {dotted}')
    target[parts[-1]] = value


def values(value):
    if isinstance(value, list):
        if not value:
            raise ValueError('Candidate list cannot be empty')
        return value
    if isinstance(value, dict) and 'range' in value:
        spec = value['range']
        start, stop, step = spec['start'], spec['stop'], spec.get('step', 1)
        if step <= 0 or stop < start or (stop-start)/step > 10000:
            raise ValueError('Invalid or excessive finite range')
        return [round(start+i*step, 10) for i in range(math.floor((stop-start)/step+1e-9)+1)]
    return [value]


def check_keys(value, template, path=''):
    if path.endswith('.baseline'):
        for key,patch in value.items():
            if key not in ('representation','reduction','clustering') or not isinstance(patch,dict):
                raise ValueError('Baseline supports representation, reduction and clustering mappings')
            check_keys(patch,DEFAULTS[key],path+'.'+key)
        return
    unknown = set(value) - set(template)
    if unknown:
        raise ValueError(f'Unknown keys in {path or "root"}: {sorted(unknown)}')
    for key in value:
        if isinstance(value[key], dict) and isinstance(template[key], dict):
            check_keys(value[key], template[key], path + '.' + key)


def validate(c):
    check_keys({k:v for k,v in c.items() if k not in ('_overrides', '_source')}, DEFAULTS)
    if c['schema_version'] != 1:
        raise ValueError('schema_version must be 1')
    if not c['datasets']:
        raise ValueError('At least one dataset is required')
    for ds in c['datasets']:
        if set(ds) - DATA_KEYS:
            raise ValueError(f'Unknown dataset keys: {set(ds)-DATA_KEYS}')
        if ds.get('adapter') not in ('jobs', 'symbolic'):
            raise ValueError('Dataset adapter must be jobs or symbolic')
        if ds.get('adapter') == 'jobs':
            if date.fromisoformat(ds.get('start', '2023-01-01')) >= date.fromisoformat(ds.get('end', '2027-01-01')):
                raise ValueError('Dataset start must precede exclusive end')
        if ds.get('family', 'occurrences') not in ('jobs', 'occurrences', 'per_symbol', 'passages'):
            raise ValueError('Unknown experiment family')
        for key in ('representation', 'reduction', 'clustering', 'sweep', 'layouts'):
            if key in ds:
                check_keys(ds[key], DEFAULTS[key], f'datasets.{key}')
        effective=merge(c, {k:ds[k] for k in ('representation','clustering','reduction','sweep','layouts') if k in ds})
        if effective['layouts']['feature_source'] not in ('representation','clustering_space'):
            raise ValueError('Layout feature_source must be representation or clustering_space')
        validate_trial(effective,ds)
        validate_trial(merge(effective,effective['sweep']['baseline']),ds)
        for search in effective['sweep']['search']:
            if set(search)-{'when','parameters'} or 'parameters' not in search:
                raise ValueError('Search branches require parameters and optional when')
            for dotted,value in search.get('when',{}).items():
                reference={'dataset':ds,**effective}
                for segment in dotted.split('.'):
                    if not isinstance(reference,dict) or segment not in reference:
                        raise ValueError(f'Unknown conditional search path: {dotted}')
                    reference=reference[segment]
            for dotted,domain in search['parameters'].items():
                for value in values(domain):
                    trial=deepcopy(effective)
                    set_value(trial,dotted,value)
                    validate_trial(trial,ds)
    validate_trial(c)
    if c['resources']['workers'] != 1:
        raise ValueError('This writer runs one candidate at a time; workers must be 1')
    for key in ('cpu_threads', 'memory_gb', 'torch_threads', 'embedding_checkpoint_rows'):
        if c['resources'][key] <= 0:
            raise ValueError(f'resources.{key} must be positive')
    for key in ('coarse_candidates','finalists','refinements_per_finalist'):
        if c['sweep'][key] < 0:
            raise ValueError(f'sweep.{key} cannot be negative')
    for size in c['sweep']['sample_sizes']:
        if size is not None and (not isinstance(size, int) or size < 20):
            raise ValueError('sample_sizes require null (full) or integers >= 20')
    for search in c['sweep']['search']:
        if set(search) - {'when', 'parameters'} or 'parameters' not in search:
            raise ValueError('Search branches require parameters and optional when')
        for key,value in search['parameters'].items():
            trial = deepcopy(c)
            set_value(trial, key, values(value)[0])
    if c['layouts']['count'] < 0:
        raise ValueError('layouts.count cannot be negative')
    if c['sweep']['full_representation_limit'] is not None and c['sweep']['full_representation_limit']<1:
        raise ValueError('full_representation_limit must be null or positive')
    if c['resources']['text_vector_cache_rows']<1:
        raise ValueError('text_vector_cache_rows must be positive')
    if c['evaluation']['profile_stop_words'] not in ('auto','english') and not isinstance(c['evaluation']['profile_stop_words'],list):
        raise ValueError('profile_stop_words must be auto, english or a list of tokens')
    if c['layouts']['feature_source'] not in ('representation','clustering_space'):
        raise ValueError('Invalid layout feature source')
    for key in ('n_neighbors','min_dist','seeds','spread','repulsion_strength'):
        values(c['layouts'][key])
    if any(x < 2 for x in values(c['layouts']['n_neighbors'])) or any(not 0<=x<=1 for x in values(c['layouts']['min_dist'])):
        raise ValueError('Invalid layout neighbors or min_dist')
    if c['evaluation']['sample_size'] < 20 or c['layouts']['trust_sample_size'] < 20:
        raise ValueError('Evaluation samples must have at least 20 rows')
    return c


def validate_trial(c, ds=None):
    r, d, h = c['representation'], c['reduction'], c['clustering']
    if r['kind'] not in ('embedding','tfidf_svd') or r['preprocessing'] not in ('raw','boilerplate'):
        raise ValueError('Unknown representation or preprocessing')
    if r['centering'] not in ('none','work','author') or not 0 <= r['centering_strength'] <= 1:
        raise ValueError('Centering must be none/work/author with strength in [0,1]')
    if r['title_weight'] < 0 or r['batch_size'] < 1 or not r['text_fields']:
        raise ValueError('Invalid title weight, batch size or text fields')
    if r['kind'] == 'embedding' and not r['revision']:
        raise ValueError('An exact model revision (commit SHA) is required for embedding caching')
    if r['kind']=='embedding':
        import re
        if not re.fullmatch('[0-9a-f]{40}',r['revision']):
            raise ValueError('Embedding revision must be an exact 40-character Hugging Face commit SHA')
    if r['kind']=='tfidf_svd' and r['max_features']!=20000:
        raise ValueError('Shared lexical implementation uses max_features=20000')
    if r['storage_dtype'] not in ('float16','float32'):
        raise ValueError('storage_dtype must be float16 or float32; stored precision is part of representation identity')
    if d['method'] not in ('none','pca','svd','umap','umap_2d'):
        raise ValueError('Reduction must be none/pca/svd/umap/umap_2d')
    if d['n_components'] < 2 or d['n_neighbors'] < 2 or not 0<=d['min_dist']<=1:
        raise ValueError('Invalid reduction dimensions, neighbors or min_dist')
    if d['pre_pca_components'] is not None and (not isinstance(d['pre_pca_components'],int) or d['pre_pca_components']<2):
        raise ValueError('pre_pca_components must be null or an integer >=2')
    if d['pca_batch_size']<2:
        raise ValueError('PCA batch size must be at least 2')
    if h['method'] not in ('hdbscan','kmeans') or h['implementation'] not in ('hdbscan','sklearn'):
        raise ValueError('Supported methods: hdbscan (hdbscan/sklearn), kmeans')
    size = h['min_cluster_size']
    if isinstance(size, dict):
        if set(size) != {'fraction'} or not 0 < size['fraction'] < 1:
            raise ValueError('min_cluster_size fraction must be in (0,1)')
    elif not isinstance(size, int) or size < 2:
        raise ValueError('min_cluster_size must be an integer >=2 or {fraction: ...}')
    if h['min_samples'] < 1 or h['cluster_selection_method'] not in ('eom','leaf'):
        raise ValueError('Invalid HDBSCAN min_samples or selection method')
    if ds and ds['adapter'] == 'jobs' and r['centering'] != 'none':
        raise ValueError('Work/author centering only applies to Symbolic Atlas')
    if ds and ds['adapter'] == 'symbolic' and r['metadata_features']:
        raise ValueError('Atlas metadata features are unsupported; use metadata for profiling')


def load(path, overrides=()):
    supplied = yaml.safe_load(Path(path).read_text(encoding='utf-8'))
    if not isinstance(supplied, dict):
        raise ValueError('Configuration must be a YAML mapping')
    check_keys(supplied, DEFAULTS)
    config = merge(DEFAULTS, supplied)
    for override in overrides:
        if '=' not in override:
            raise ValueError('--set needs path=value')
        key,value = override.split('=',1)
        set_value(config, key, yaml.safe_load(value))
    config['_overrides'], config['_source'] = list(overrides), str(Path(path).resolve())
    return validate(config)
