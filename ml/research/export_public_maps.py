"""Export small, text-free views of the consensus picks and the municipal groups for the site; never upload them.

python -m ml.research.export_public_maps

A cluster gets a name only from configs/cluster_lab/public_topic_names.yaml, and only while the
run id recorded there is still the pick: a rerun that changes the groups drops the names.
The run id is a digest of the labels (ml/research/consensus.py).
"""
import json
from pathlib import Path

import pandas as pd
import yaml

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'warehouse/cluster_lab/public-consensus-2026-10-13'
EARLIER = ROOT / 'warehouse/cluster_lab/public-topics-2026-10-12'
TARGET = ROOT / 'frontend/public/data/cluster-research'
NAMES = ROOT / 'configs/cluster_lab/public_topic_names.yaml'
POINTS = 3000
LABEL = {'debate': lambda p: f"{p['speaker']} ({p['party']}) · {p['speech_date']}",
         'philosophy': lambda p: f"{p['author']}, {p['title']}"}


def write(slug, result):
    TARGET.mkdir(parents=True, exist_ok=True)
    (TARGET / f'{slug}.json').write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(f"{slug}: {len(result['points'])}/{result['observations']} points, {result['clusters']} groups, {len(result['names'])} named")


def topics(name, slug, names):
    pick = json.loads((SOURCE / f'pick-{name}.json').read_text(encoding='utf-8'))
    layout = json.loads((SOURCE / f'layout-{name}.json').read_text(encoding='utf-8'))
    v, refinement = pick['settings'], pick['refinement']
    if layout['run_id'] != pick['run_id']:
        raise ValueError(f'{name}: the map was drawn for another pick; run consensus layout again')
    manifest = next(p for p in (root / 'datasets' / v['corpus'] / 'manifest.json' for root in (SOURCE, EARLIER)) if p.exists())
    frame = (pd.read_parquet(SOURCE / f'layout-{name}.parquet')
             .merge(pd.read_parquet(SOURCE / pick['variant'] / 'assignments.parquet'), on='observation_id')
             .merge(pd.read_parquet(json.loads(manifest.read_text(encoding='utf-8'))['path']), on='observation_id'))
    size = min(POINTS, len(frame))
    points = frame.iloc[[i * len(frame) // size for i in range(size)]].to_dict('records')
    reviewed = names.get(name, {})
    removed = pick['corpus_observations'] - pick['observations']
    result = {
        'run_id': pick['run_id'], 'observations': pick['observations'], 'corpus_observations': pick['corpus_observations'],
        'clusters': pick['clusters'], 'noise_share': pick['noise_share'], 'core_noise_share': pick['core_noise_share'],
        'seed_ari': pick['split_half_ari']['with_noise'], 'stable': pick['stable'], 'trustworthiness': layout['trustworthiness'],
        'names': reviewed.get('names', {}) if reviewed.get('run_id') == pick['run_id'] else {},
        'method': [
            v['model'].split('/')[-1] + f", centred per {'speaker' if v['centering'] == 'author' else v['centering']}",
            *([f"{removed} passages of replies and general rhetoric removed first"] if removed else []),
            f"UMAP 5D, n_neighbors {v['neighbors']}, min_dist 0, {pick['seeds']} seeds",
            f"HDBSCAN min_cluster_size {v['min_cluster_size']}, min_samples {v['min_samples']}, eom",
            f"consensus of the seeds: {pick['core_groups']} groups, merged at centroid cosine {refinement['merged']['similarity']} to {pick['clusters']}",
            f"noise {pick['core_noise_share']:.1%} to {pick['noise_share']:.1%} after reassignment",
            f"ARI between the consensus of even and odd seeds {pick['split_half_ari']['with_noise']:.2f}",
            f"map UMAP 2D, n_neighbors {layout['n_neighbors']}, min_dist {layout['min_dist']}, trustworthiness {layout['trustworthiness']:.2f}",
            f"shown {size}/{pick['observations']}", f"run {pick['run_id']}"],
        'points': [[p['observation_id'], round(p['x'], 3), round(p['y'], 3), p['cluster'], LABEL[name](p)] for p in points]}
    write(slug, result)


def municipalities(names):
    source = json.loads((SOURCE / 'regions-municipalities.json').read_text(encoding='utf-8'))
    variance = sum(source['explained_variance'][:2])
    kmeans = {c['k']: c for c in source['comparison'] if c['method'] == 'kmeans'}
    # The finer stable split is the one drawn; the gap rule's smaller k is stated beside it.
    finer = source.get('finer')
    k = finer['k'] if finer else source['k']
    write('municipalities', {
        'run_id': f"regions-{source['year']}-k{k}", 'observations': source['municipalities'], 'clusters': k,
        'noise_share': 0.0, 'names': names.get('municipalities', {}).get('names', {}) if names.get('municipalities', {}).get('k') == k else {},
        'method': [
            f"{len(source['features'])} indicators, {source['year']}", source['method'].replace(f"k={source['k']}", f'k={k}'),
            f"silhouette {kmeans[k]['silhouette']:.2f}, shuffled columns 95th percentile {source['kmeans_null_95'][str(k)]:.2f}",
            f"bootstrap ARI {kmeans[k]['bootstrap_ari']:.2f}", f"AMI against SKR's municipality groups {kmeans[k]['ami_skr_groups']:.2f}",
            *([f"the gap rule alone gives k={source['k']} (bootstrap ARI {kmeans[source['k']]['bootstrap_ari']:.2f})"] if finer else []),
            f"map: first two principal components, {variance:.0%} of the variance"],
        'points': [[p['code'], p['x'], p['y'], p['finer_group'] if finer else p['group'], f"{p['name']} · {p['county']} · {p['skr_group']}"] for p in source['points']]})


def main():
    names = yaml.safe_load(NAMES.read_text(encoding='utf-8')) if NAMES.exists() else {}
    topics('debate', 'debate-topics', names)
    topics('philosophy', 'philosophy-topics', names)
    municipalities(names)


if __name__ == '__main__':
    main()
