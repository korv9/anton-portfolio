"""Offline, checkpointed parameter search; never changes the published assignments."""
from __future__ import annotations

import argparse
from collections import Counter
import hashlib
import itertools
import json
from pathlib import Path

import numpy as np
import pandas as pd

from .embeddings import DEFAULT_MODEL, REPRESENTATION
from .prepare import load_jobs

REVISION = 'e8f8c211226b894fcb81acc59f3b34ba3efd5f42'
ROOT = Path(__file__).resolve().parents[2]
SWEEP_VERSION = 1


def analysis_metadata_sha(jobs, employers):
    body = jobs[['job_id', 'title', 'skills', 'role_family', 'seniority', 'published_year', 'region']].to_json(orient='records')
    return hashlib.sha256((body + json.dumps(employers.tolist(), ensure_ascii=False)).encode()).hexdigest()


def cached_embeddings(jobs, directory, model, revision):
    key = hashlib.sha256(f'{model}@{revision}:{REPRESENTATION}'.encode()).hexdigest()[:16]
    frame = pd.read_parquet(directory / f'embeddings-{key}.parquet')
    lookup = dict(zip(frame.text_hash, frame.embedding))
    if not set(jobs.text_hash).issubset(lookup):
        raise ValueError('Incomplete embedding cache; run the embedding pipeline first')
    matrix = np.stack([lookup[h] for h in jobs.text_hash]).astype('float32')
    if not np.isfinite(matrix).all():
        raise ValueError('Nonfinite cached embeddings')
    return matrix


def structure(labels, employers):
    assigned = labels != -1
    sizes = Counter(labels[assigned].tolist())
    dominant = 0
    weighted_top = 0
    for cid, size in sizes.items():
        values = employers[labels == cid]
        # Missing employer names must not count as one real employer.
        top = max(Counter(v for v in values if v).values(), default=0)
        weighted_top += top
        if top / size > .5:
            dominant += size
    return {'cluster_count': len(sizes), 'noise_share': float((~assigned).mean()),
            'largest_cluster_share': max(sizes.values(), default=0) / len(labels),
            'employer_majority_share': dominant / max(1, int(assigned.sum())),
            'weighted_top_employer_share': weighted_top / max(1, int(assigned.sum())),
            'cluster_sizes': dict(sorted(sizes.items()))}


def separation(labels, distances, indices):
    from sklearn.metrics import silhouette_score
    keep = labels[indices] != -1
    sampled = labels[indices][keep]
    if not 1 < len(set(sampled)) < len(sampled):
        return None
    return float(silhouette_score(distances[np.ix_(keep, keep)], sampled, metric='precomputed'))


def score(row):
    """Exploratory tradeoff, not a validated accuracy or occupational quality score."""
    if row['embedding_silhouette'] is None or row['cluster_count'] < 2:
        return -10.
    return (row['embedding_silhouette'] - .3 * row['noise_share']
            - .5 * row['largest_cluster_share'] - .15 * row['employer_majority_share'])


def run(database, directory, revision=REVISION, seed=42):
    import duckdb
    import importlib.metadata
    from hdbscan import HDBSCAN
    from joblib import Memory
    from sklearn.metrics import pairwise_distances
    from umap import UMAP

    jobs, _ = load_jobs(database)
    embeddings = cached_embeddings(jobs, directory, DEFAULT_MODEL, revision)
    with duckdb.connect(str(database), read_only=True) as con:
        employer_lookup = dict(con.execute('select job_id, employer_name from silver.int_job_ads_enriched').fetchall())
    employers = np.asarray([str(employer_lookup.get(jid) or '').strip() for jid in jobs.job_id])
    versions = {p: importlib.metadata.version(p) for p in ['numpy', 'scikit-learn', 'umap-learn', 'hdbscan']}
    identity = hashlib.sha256(('\n'.join(jobs.job_id + ':' + jobs.text_hash)
                              + json.dumps(versions, sort_keys=True) + revision + str(seed)).encode()).hexdigest()[:16]
    folder = directory / 'sweeps' / identity
    folder.mkdir(parents=True, exist_ok=True)
    indices = np.sort(np.random.default_rng(seed).choice(len(jobs), min(1200, len(jobs)), replace=False))
    original_distances = pairwise_distances(embeddings[indices], metric='cosine')
    np.fill_diagonal(original_distances, 0)
    jobs[['job_id', 'text_hash']].to_parquet(folder / 'inputs.parquet', index=False)
    reductions = list(itertools.product([10, 30, 60], [5, 15], [0., .1])) + [(30, 15, .05)]
    rows = []
    for neighbors, dimensions, min_dist in reductions:
        key = f'n{neighbors}-d{dimensions}-md{min_dist}-s{seed}'
        path = folder / f'{key}.npy'
        if path.exists():
            space = np.load(path)
        else:
            print(f'Reducing {key}', flush=True)
            space = UMAP(n_neighbors=neighbors, n_components=dimensions, min_dist=min_dist,
                         metric='cosine', random_state=seed, n_jobs=1, init='random').fit_transform(embeddings)
            np.save(path, space)
        distances = pairwise_distances(space[indices])
        np.fill_diagonal(distances, 0)
        memory = Memory(folder / 'hierarchies' / key, verbose=0)
        settings = list(itertools.product([20, 30, 60, 100], [3, 5, 10, 20], ['eom', 'leaf']))
        if (neighbors, dimensions, min_dist) == (30, 15, .05):
            settings += [(50, 10, 'eom')]
        for size, samples, method in settings:
            cid = f'{key}-c{size}-ms{samples}-{method}'
            result_path = folder / f'{cid}.json'
            if result_path.exists():
                row = json.loads(result_path.read_text(encoding='utf-8'))
                # Refresh employer diagnostics even when only source metadata changed.
                labels = np.load(folder / f'{cid}.npz')['labels']
                row.update(structure(labels, employers))
                row['exploratory_score'] = score(row)
                result_path.write_text(json.dumps(row, indent=2, allow_nan=False), encoding='utf-8')
            else:
                fitted = HDBSCAN(min_cluster_size=size, min_samples=samples,
                                 cluster_selection_method=method, core_dist_n_jobs=1, memory=memory).fit(space)
                labels = fitted.labels_
                row = {'candidate': cid, 'neighbors': neighbors, 'dimensions': dimensions,
                       'cluster_min_dist': min_dist, 'min_cluster_size': size, 'min_samples': samples,
                       'selection_method': method, 'seed': seed, **structure(labels, employers),
                       'embedding_silhouette': separation(labels, original_distances, indices),
                       'umap_silhouette': separation(labels, distances, indices),
                       'mean_probability': float(fitted.probabilities_[labels != -1].mean()) if (labels != -1).any() else None}
                row['exploratory_score'] = score(row)
                np.savez_compressed(folder / f'{cid}.npz', labels=labels, probabilities=fitted.probabilities_)
                result_path.write_text(json.dumps(row, indent=2, allow_nan=False), encoding='utf-8')
            rows.append(row)
        best = max(rows, key=lambda r: r['exploratory_score'])
        print(f'{key}: {len(rows)} candidates; best {best["candidate"]}: '
              f'{best["cluster_count"]} groups, noise {best["noise_share"]:.1%}, '
              f'largest {best["largest_cluster_share"]:.1%}, original silhouette {best["embedding_silhouette"]:.3f}', flush=True)
    rows.sort(key=lambda r: r['exploratory_score'], reverse=True)
    report = {'schema_version': 1, 'sweep_version': SWEEP_VERSION, 'dataset_size': len(jobs), 'model': DEFAULT_MODEL,
              'analysis_metadata_sha': analysis_metadata_sha(jobs, employers),
              'revision': revision, 'representation': REPRESENTATION, 'versions': versions,
              'seed': seed, 'diagnostic_sample_size': len(indices),
              'selection_note': 'Exploratory score penalises noise, a dominant cluster and employer-majority groups; original-space cosine silhouette is measured on a fixed sample excluding noise. Manual profile and seed review required before adoption.',
              'candidates': rows}
    (folder / 'report.json').write_text(json.dumps(report, indent=2, allow_nan=False), encoding='utf-8')
    pd.DataFrame([{k: v for k, v in r.items() if k != 'cluster_sizes'} for r in rows]).to_csv(folder / 'candidates.csv', index=False)
    print(f'Sweep saved: {folder}; {len(rows)} candidates', flush=True)
    return folder


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--database', type=Path, default=ROOT / 'warehouse/jobtech/history.duckdb')
    parser.add_argument('--output', type=Path, default=ROOT / 'warehouse/ml/jobs')
    parser.add_argument('--revision', default=REVISION)
    parser.add_argument('--seed', type=int, default=42)
    parser.add_argument('--review', type=Path, nargs='+', help='Candidate JSON files to profile and check across seeds 43 and 44')
    args = parser.parse_args()
    if args.review:
        review(args.database, args.output, args.review, args.revision)
    else:
        run(args.database, args.output, args.revision, args.seed)


def review(database, directory, candidate_paths, revision=REVISION):
    import duckdb
    from sklearn.metrics import adjusted_rand_score
    from umap import UMAP
    from .cluster import cluster
    from .profile import profiles

    jobs, _ = load_jobs(database)
    embeddings = cached_embeddings(jobs, directory, DEFAULT_MODEL, revision)
    with duckdb.connect(str(database), read_only=True) as con:
        lookup = dict(con.execute('select job_id, employer_name from silver.int_job_ads_enriched').fetchall())
    employers = np.asarray([str(lookup.get(jid) or '').strip() for jid in jobs.job_id])
    for path in candidate_paths:
        if not pd.read_parquet(path.parent / 'inputs.parquet').equals(jobs[['job_id', 'text_hash']]):
            raise ValueError('Review corpus differs from sweep inputs')
        config = json.loads(path.read_text(encoding='utf-8'))
        fitted = np.load(path.with_suffix('.npz'))
        base = fitted['labels']
        profiled = profiles(jobs.assign(cluster_id=base, cluster_probability=fitted['probabilities']))
        for profile in profiled:
            names = employers[base == profile['cluster_id']]
            profile['top_employers'] = [{'label': name, 'count': count, 'share': count / len(names)}
                                        for name, count in Counter(v for v in names if v).most_common(3)]
        stability = []
        for seed in [43, 44]:
            key = f'n{config["neighbors"]}-d{config["dimensions"]}-md{config["cluster_min_dist"]}-s{seed}'
            cache = path.parent / f'{key}.npy'
            if cache.exists():
                space = np.load(cache)
            else:
                space = UMAP(n_neighbors=config['neighbors'], n_components=config['dimensions'],
                             min_dist=config['cluster_min_dist'], metric='cosine', random_state=seed,
                             n_jobs=1, init='random').fit_transform(embeddings)
                np.save(cache, space)
            labels, _ = cluster(space, config['min_cluster_size'], config['min_samples'], config['selection_method'])
            common = (base != -1) & (labels != -1)
            stability.append({'seed': seed, **structure(labels, employers),
                              'ari_all_including_noise': float(adjusted_rand_score(base, labels)),
                              'common_assigned_share': float(common.mean()),
                              'ari_common_assigned': float(adjusted_rand_score(base[common], labels[common])) if common.sum() > 1 else None})
            print(f'Review {config["candidate"]}, seed {seed}: '
                  f'{len(set(labels) - {-1})} clusters; noise {(labels == -1).mean():.1%}; '
                  f'ARI common assigned {stability[-1]["ari_common_assigned"]:.3f}', flush=True)
        target = path.with_name(path.stem + '-review.json')
        target.write_text(json.dumps({'candidate': config, 'analysis_metadata_sha': analysis_metadata_sha(jobs, employers),
                                     'stability': stability, 'profiles': profiled}, indent=2, ensure_ascii=False, allow_nan=False), encoding='utf-8')


if __name__ == '__main__':
    main()
