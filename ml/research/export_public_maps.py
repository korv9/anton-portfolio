"""Export small, text-free views of the picked runs and the municipal groups for the site; never upload them.

python -m ml.research.export_public_maps

A cluster gets a name only from configs/cluster_lab/public_topic_names.yaml, and only while the
run id recorded there is still the pick: a rerun that changes the groups drops the names.
"""
import json
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'warehouse/cluster_lab/public-topics-2026-10-12'
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
    index = json.loads((SOURCE / 'gallery/index.json').read_text(encoding='utf-8'))
    run = next(r for r in index['runs'] if r['run_id'] == pick['run_id'])
    metrics = json.loads((SOURCE / 'gallery' / run['run_id'] / 'metrics.json').read_text(encoding='utf-8'))
    # The most faithful of the saved maps: highest trustworthiness against the original vectors.
    layout = max(run['layouts'], key=lambda l: l['quality']['value'])
    view = json.loads((SOURCE / 'gallery' / layout['view']).read_text(encoding='utf-8'))['points']
    size = min(POINTS, len(view))
    points = [view[i * len(view) // size] for i in range(size)]
    r, d, h = (run['parameters'][k] for k in ('representation', 'reduction', 'clustering'))
    refinement = metrics['refinement']
    reviewed = names.get(name, {})
    result = {
        'run_id': run['run_id'], 'layout_id': layout['layout_id'], 'observations': run['observations'],
        'clusters': run['clusters'], 'noise_share': run['noise_share'],
        'core_noise_share': refinement['core_noise_share'],
        'seed_ari': pick['seed_ari_with_noise'], 'trustworthiness': layout['quality']['value'],
        'names': reviewed.get('names', {}) if reviewed.get('run_id') == run['run_id'] else {},
        'method': [
            r['model'].replace('sentence-transformers/', '') + ('' if r['centering'] == 'none' else f", centred per {'speaker' if name == 'debate' else r['centering']}"),
            f"UMAP {d['n_components']}D, n_neighbors {d['n_neighbors']}, min_dist {d['min_dist']}",
            f"HDBSCAN min_cluster_size {h['min_cluster_size']}, min_samples {h['min_samples']}, {h['cluster_selection_method']}"
            + (f", max_cluster_size {h['max_cluster_size']}" if h['max_cluster_size'] else ''),
            f"merge at centroid cosine {h['merge_similarity']}: {refinement['core_clusters']} to {run['clusters']} groups",
            f"noise {refinement['core_noise_share']:.1%} to {run['noise_share']:.1%} after reassignment",
            f"seed ARI {pick['seed_ari_with_noise']:.2f}",
            f"map UMAP 2D, n_neighbors {layout['parameters']['n_neighbors']}, min_dist {layout['parameters']['min_dist']}, trustworthiness {layout['quality']['value']:.2f}",
            f"shown {size}/{run['observations']}", f"run {run['run_id']}"],
        'points': [[p['observation_id'], p['x'], p['y'], p['cluster'], LABEL[name](p)] for p in points]}
    write(slug, result)


def municipalities(names):
    source = json.loads((SOURCE / 'regions-municipalities.json').read_text(encoding='utf-8'))
    variance = sum(source['explained_variance'][:2])
    write('municipalities', {
        'run_id': f"regions-{source['year']}", 'observations': source['municipalities'], 'clusters': source['k'],
        'noise_share': 0.0, 'names': names.get('municipalities', {}).get('names', {}),
        'method': [
            f"{len(source['features'])} Kolada indicators, {source['year']}", source['method'],
            f"silhouette {source['silhouette']:.2f}, shuffled columns 95th percentile {source['permutation']['percentile_95']:.2f}",
            f"bootstrap ARI {next(c['bootstrap_ari'] for c in source['comparison'] if c['method'] == 'kmeans' and c['k'] == source['k']):.2f}",
            f"map: first two principal components, {variance:.0%} of the variance"],
        'points': [[p['code'], p['x'], p['y'], p['group'], f"{p['name']} · {p['county']} · {p['skr_group']}"] for p in source['points']]})


def main():
    names = yaml.safe_load(NAMES.read_text(encoding='utf-8')) if NAMES.exists() else {}
    topics('debate', 'debate-topics', names)
    topics('philosophy', 'philosophy-topics', names)
    municipalities(names)


if __name__ == '__main__':
    main()
