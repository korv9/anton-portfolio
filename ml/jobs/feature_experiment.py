"""Ablations and optional three-fit consensus for the technical multi-view ensemble."""
from __future__ import annotations

import argparse
import hashlib
import itertools
import json
from pathlib import Path

import numpy as np
import pandas as pd

from .features import build_blocks, fuse, RECIPES
from .prepare import load_jobs
from .sweep import REVISION, ROOT, structure, separation, analysis_metadata_sha


def align_labels(reference, alternate):
    """Match real clusters on overlapping ads; noise never becomes a cluster."""
    from scipy.optimize import linear_sum_assignment
    refs = sorted(set(reference) - {-1})
    alts = sorted(set(alternate) - {-1})
    aligned = np.full(len(reference), -1, dtype=int)
    if not refs or not alts:
        return aligned
    counts = np.array([[np.sum((reference == r) & (alternate == a)) for a in alts] for r in refs])
    rows, cols = linear_sum_assignment(-counts)
    for r, c in zip(rows, cols):
        # Require most of the alternate cluster's assigned reference overlap to
        # support its matched cluster, preventing arbitrary matches of split groups.
        overlap = int(counts[:, c].sum())
        if overlap and counts[r, c] / overlap > .5:
            aligned[alternate == alts[c]] = refs[r]
    return aligned


def consensus(label_sets):
    reference = label_sets[0]
    aligned = np.stack([reference] + [align_labels(reference, a) for a in label_sets[1:]])
    result = np.full(len(reference), -1, dtype=int)
    support = np.zeros(len(reference), dtype=float)
    for i in range(len(reference)):
        values, counts = np.unique(aligned[:, i][aligned[:, i] != -1], return_counts=True)
        if len(counts) and counts.max() >= 2:
            j = counts.argmax()
            result[i], support[i] = values[j], counts[j] / len(label_sets)
    return result, support


def fit(matrix, config, folder, seed=42):
    from umap import UMAP
    from .cluster import cluster
    prefix = 'baseline-exact' if config['recipe'] == 'baseline' else config['recipe']
    key = f'{prefix}-n{config["neighbors"]}-d{config["dimensions"]}-s{seed}'
    path = folder / f'{key}.npy'
    if path.exists():
        space = np.load(path)
    else:
        space = UMAP(n_neighbors=config['neighbors'], n_components=config['dimensions'],
                     min_dist=0., metric='cosine', random_state=seed, n_jobs=1, init='random').fit_transform(matrix)
        np.save(path, space)
    ids, probs = cluster(space, config['min_cluster_size'], config['min_samples'], config['selection_method'])
    return space, ids, probs


def prepare(database, directory, revision):
    import duckdb
    import importlib.metadata
    jobs, _ = load_jobs(database)
    with duckdb.connect(str(database), read_only=True) as con:
        lookup = dict(con.execute('select job_id, employer_name from silver.int_job_ads_enriched').fetchall())
    employers = np.asarray([str(lookup.get(jid) or '').strip() for jid in jobs.job_id])
    blocks, feature_report, feature_folder = build_blocks(jobs, directory, revision)
    identity = hashlib.sha256((feature_folder.name + analysis_metadata_sha(jobs, employers) + 'experiment-v1').encode()).hexdigest()[:16]
    folder = directory / 'feature-experiments' / identity
    folder.mkdir(parents=True, exist_ok=True)
    report_path = folder / 'report.json'
    if report_path.exists():
        previous = json.loads(report_path.read_text(encoding='utf-8'))
        if previous.get('versions') and any(importlib.metadata.version(p) != version for p, version in previous['versions'].items()):
            raise ValueError('Experiment cache uses different package versions; rebuild its projections before reuse')
    jobs[['job_id', 'text_hash']].to_parquet(folder / 'inputs.parquet', index=False)
    return jobs, employers, blocks, feature_report, folder


def run(database, directory, revision=REVISION):
    import importlib.metadata
    from sklearn.metrics import pairwise_distances
    jobs, employers, blocks, feature_report, folder = prepare(database, directory, revision)
    indices = np.sort(np.random.default_rng(42).choice(len(jobs), min(1200, len(jobs)), replace=False))
    raw_distances = pairwise_distances(blocks['raw'][indices], metric='cosine')
    np.fill_diagonal(raw_distances, 0)
    clean_distances = pairwise_distances(blocks['clean'][indices], metric='cosine')
    np.fill_diagonal(clean_distances, 0)
    rows = []
    for recipe in RECIPES:
        matrix = blocks['raw'] if recipe == 'baseline' else fuse(blocks, RECIPES[recipe])
        distances = pairwise_distances(matrix[indices], metric='cosine')
        np.fill_diagonal(distances, 0)
        for neighbors, dimensions in [(30, 5), (60, 10)]:
            for size, samples, method in itertools.product([40, 60, 100], [3, 5], ['eom', 'leaf']):
                config = {'recipe': recipe, 'neighbors': neighbors, 'dimensions': dimensions,
                          'cluster_min_dist': 0., 'min_cluster_size': size, 'min_samples': samples,
                          'selection_method': method, 'seed': 42}
                cid = f'{recipe}-n{neighbors}-d{dimensions}-c{size}-ms{samples}-{method}'
                target = folder / f'{cid}.json'
                cached = json.loads(target.read_text(encoding='utf-8')) if target.exists() else None
                if cached and (recipe != 'baseline' or cached.get('exact_raw_baseline')):
                    row = cached
                else:
                    space, labels, probabilities = fit(matrix, config, folder)
                    row = {'candidate': cid, **config, **structure(labels, employers),
                           'raw_embedding_silhouette': separation(labels, raw_distances, indices),
                           'clean_embedding_silhouette': separation(labels, clean_distances, indices),
                           'exact_raw_baseline': recipe == 'baseline',
                           'feature_silhouette': separation(labels, distances, indices),
                           'mean_probability': float(probabilities[labels != -1].mean()) if (labels != -1).any() else None}
                    np.savez_compressed(folder / f'{cid}.npz', labels=labels, probabilities=probabilities)
                    target.write_text(json.dumps(row, indent=2, allow_nan=False), encoding='utf-8')
                if 'clean_embedding_silhouette' not in row:
                    row['clean_embedding_silhouette'] = separation(np.load(target.with_suffix('.npz'))['labels'], clean_distances, indices)
                    target.write_text(json.dumps(row, indent=2, allow_nan=False), encoding='utf-8')
                rows.append(row)
            eligible = [r for r in rows if 5 <= r['cluster_count'] <= 40 and r['noise_share'] <= .5 and r['largest_cluster_share'] < .25]
            if eligible:
                best = max(eligible, key=lambda r: (r['raw_embedding_silhouette'] or -1) - .3*r['noise_share'] - .2*r['employer_majority_share'])
                print(f'{recipe} / n{neighbors} d{dimensions}; {len(rows)} fits: best {best["candidate"]}, '
                      f'{best["cluster_count"]} groups, noise {best["noise_share"]:.1%}, '
                      f'employer-majority {best["employer_majority_share"]:.1%}', flush=True)
    report = {'schema_version': 1, 'dataset_size': len(jobs), 'revision': revision,
              'versions': {p: importlib.metadata.version(p) for p in ('numpy', 'scikit-learn', 'umap-learn', 'hdbscan', 'scipy')},
              'analysis_metadata_sha': analysis_metadata_sha(jobs, employers),
              'feature_report': feature_report, 'diagnostic_sample_size': len(indices), 'candidates': rows}
    (folder / 'report.json').write_text(json.dumps(report, indent=2, ensure_ascii=False, allow_nan=False), encoding='utf-8')
    pd.DataFrame([{k: v for k, v in r.items() if k != 'cluster_sizes'} for r in rows]).to_csv(folder / 'candidates.csv', index=False)
    print(f'Feature experiment: {folder}; {len(rows)} candidates', flush=True)


def review(database, directory, paths, revision=REVISION):
    from sklearn.metrics import adjusted_rand_score, pairwise_distances
    from .profile import profiles
    jobs, employers, blocks, feature_report, folder = prepare(database, directory, revision)
    indices = np.sort(np.random.default_rng(42).choice(len(jobs), min(1200, len(jobs)), replace=False))
    distances = pairwise_distances(blocks['raw'][indices], metric='cosine')
    np.fill_diagonal(distances, 0)
    for path in paths:
        if path.parent.resolve() != folder.resolve():
            raise ValueError('Candidate does not match feature/corpus identity')
        config = json.loads(path.read_text(encoding='utf-8'))
        matrix = blocks['raw'] if config['recipe'] == 'baseline' else fuse(blocks, RECIPES[config['recipe']])
        saved = np.load(path.with_suffix('.npz'))
        label_sets = [saved['labels']]
        stability = []
        for seed in [43, 44]:
            _, labels, _ = fit(matrix, config, folder, seed)
            common = (saved['labels'] != -1) & (labels != -1)
            stability.append({'seed': seed, **structure(labels, employers),
                              'ari_all_including_noise': float(adjusted_rand_score(saved['labels'], labels)),
                              'common_assigned_share': float(common.mean()),
                              'ari_common_assigned': float(adjusted_rand_score(saved['labels'][common], labels[common])) if common.sum() > 1 else None})
            label_sets.append(labels)
            print(f'{config["candidate"]} seed {seed}: noise {(labels == -1).mean():.1%}, '
                  f'common assigned ARI {stability[-1]["ari_common_assigned"]:.3f}', flush=True)
        ids, support = consensus(label_sets)
        consensus_metrics = {**structure(ids, employers), 'raw_embedding_silhouette': separation(ids, distances, indices)}
        clean_distances = pairwise_distances(blocks['clean'][indices], metric='cosine')
        np.fill_diagonal(clean_distances, 0)
        consensus_metrics['clean_embedding_silhouette'] = separation(ids, clean_distances, indices)
        feature_distances = pairwise_distances(matrix[indices], metric='cosine')
        np.fill_diagonal(feature_distances, 0)
        consensus_metrics['feature_silhouette'] = separation(ids, feature_distances, indices)
        np.savez_compressed(path.with_name(path.stem + '-consensus.npz'), labels=ids, probabilities=support)
        def profiled(labels, probabilities):
            result = profiles(jobs.assign(cluster_id=labels, cluster_probability=probabilities))
            for profile in result:
                values = employers[labels == profile['cluster_id']]
                from collections import Counter
                profile['top_employers'] = [{'label': name, 'count': count, 'share': count / len(values)} for name, count in Counter(v for v in values if v).most_common(3)]
            return result
        output = {'candidate': config, 'feature_id': feature_report['feature_id'],
                  'analysis_metadata_sha': analysis_metadata_sha(jobs, employers), 'stability': stability,
                  'consensus': consensus_metrics,
                  'profiles': profiled(saved['labels'], saved['probabilities']),
                  'consensus_profiles': profiled(ids, support)}
        path.with_name(path.stem + '-review.json').write_text(json.dumps(output, indent=2, ensure_ascii=False, allow_nan=False), encoding='utf-8')
        print(f'Consensus: {len(set(ids) - {-1})} clusters; noise {(ids == -1).mean():.1%}; '
              f'employer-majority {consensus_metrics["employer_majority_share"]:.1%}', flush=True)


def check_consensus_windows(database, directory, path, revision=REVISION):
    from sklearn.metrics import adjusted_rand_score
    jobs, employers, blocks, _, folder = prepare(database, directory, revision)
    if path.parent.resolve() != folder.resolve():
        raise ValueError('Candidate corpus/feature identity differs')
    reviewed_path = path.with_name(path.stem + '-review.json')
    reviewed = json.loads(reviewed_path.read_text(encoding='utf-8'))
    config = reviewed['candidate']
    matrix = fuse(blocks, RECIPES[config['recipe']])
    reference = np.load(path.with_name(path.stem + '-consensus.npz'))['labels']
    fits = {}
    for seed in [43, 44, 45, 46, 47]:
        _, fits[seed], _ = fit(matrix, config, folder, seed)
    results = []
    for seeds in ([43, 44, 45], [44, 45, 46], [45, 46, 47]):
        labels, _ = consensus([fits[s] for s in seeds])
        common = (reference != -1) & (labels != -1)
        row = {'seeds': seeds, **structure(labels, employers),
               'ari_all_including_noise': float(adjusted_rand_score(reference, labels)),
               'common_assigned_share': float(common.mean()),
               'ari_common_assigned': float(adjusted_rand_score(reference[common], labels[common])) if common.sum() > 1 else None}
        results.append(row)
        print(f'Consensus window {seeds}: {row["cluster_count"]} groups, noise {row["noise_share"]:.1%}, '
              f'ARI all {row["ari_all_including_noise"]:.3f}, common {row["ari_common_assigned"]:.3f}', flush=True)
    reviewed['consensus_window_stability'] = results
    reviewed_path.write_text(json.dumps(reviewed, indent=2, ensure_ascii=False, allow_nan=False), encoding='utf-8')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--database', type=Path, default=ROOT / 'warehouse/jobtech/history.duckdb')
    parser.add_argument('--output', type=Path, default=ROOT / 'warehouse/ml/jobs')
    parser.add_argument('--revision', default=REVISION)
    parser.add_argument('--review', type=Path, nargs='+')
    parser.add_argument('--consensus-check', type=Path)
    args = parser.parse_args()
    if args.consensus_check:
        check_consensus_windows(args.database, args.output, args.consensus_check, args.revision)
    elif args.review:
        review(args.database, args.output, args.review, args.revision)
    else:
        run(args.database, args.output, args.revision)


if __name__ == '__main__':
    main()
