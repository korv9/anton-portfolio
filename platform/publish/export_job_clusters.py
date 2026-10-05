"""Compact, versioned delivery from gold; never exports descriptions or embeddings."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def export(database: Path, output: Path):
    import duckdb
    with duckdb.connect(str(database), read_only=True) as con:
        points = con.execute('select * from gold.mart_job_clusters order by job_id').df().to_dict('records')
        profiles = con.execute('select * from gold.dim_job_clusters order by cluster_id').df().to_dict('records')
        report = json.loads(con.execute('select report_json from raw.job_cluster_runs').fetchone()[0])
    run_id = report['run_id']
    if any(row['run_id'] != run_id for row in points + profiles):
        raise ValueError('Gold marts and ML run differ; rebuild dbt cluster models before exporting')
    for row in profiles:
        for field in ('top_titles', 'top_skills', 'role_distribution', 'regions', 'years', 'representative_ads'):
            row[field] = json.loads(row[field])
        if 'top_employers' in row:
            row['top_employers'] = json.loads(row['top_employers'])
    delivered = [{'id': row['job_id'], 'x': round(row['umap_x'], 5), 'y': round(row['umap_y'], 5),
                  'cluster': row['cluster_id'], 'cluster_label': row['cluster_label'],
                  'probability': row['cluster_probability'], 'role': row['role_family'],
                  'seniority': row['seniority'], 'year': row['published_year'],
                  'region': row['region'] if isinstance(row['region'], str) else 'Unspecified',
                  'title': row['title'], 'skills': list(row['skills'])} for row in points]
    if len(delivered) != report['diagnostics']['dataset_size']:
        raise ValueError('Delivery row count does not match evaluated dataset')
    output.mkdir(parents=True, exist_ok=True)
    version = output / 'clusters' / run_id
    version.mkdir(parents=True, exist_ok=True)
    def write(path, body):
        temporary = path.with_suffix('.tmp')
        temporary.write_text(json.dumps(body, ensure_ascii=False, separators=(',', ':'), allow_nan=False), encoding='utf-8')
        temporary.replace(path)
    # Immutable point shards precede the manifest. Browsers never pair different runs.
    shards = []
    for index in range(0, len(delivered), 5000):
        name = f'points-{index // 5000}.json'
        write(version / name, {'run_id': run_id, 'points': delivered[index:index + 5000]})
        shards.append(f'jobs/clusters/{run_id}/{name}')
    preview = sorted(delivered, key=lambda p: hashlib.sha256(p['id'].encode()).hexdigest())[:1500]
    write(output / 'cluster-preview.json', {'run_id': run_id, 'sampled': report['sampled'],
          'points': [{'id': p['id'], 'x': p['x'], 'y': p['y'], 'cluster': p['cluster']} for p in preview]})
    safe_report = {key: report[key] for key in ('run_id', 'generated_at', 'source_size', 'sampled', 'source_kinds', 'config', 'diagnostics', 'parameter_comparisons', 'versions')}
    safe_report.update({key: report[key] for key in ('coverage', 'candidate_count', 'unique_text_count', 'parameter_sweep', 'feature_ensemble') if key in report})
    write(output / 'cluster-summary.json', {**safe_report, 'schema_version': 1, 'shards': shards, 'clusters': profiles})
    print(f'Exported {len(delivered)} real points, {len(profiles)} profiles and {len(preview)} preview points')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--database', type=Path, default=Path(os.getenv('ML_JOBS_DB', ROOT / 'warehouse/jobtech/history.duckdb')))
    parser.add_argument('--output', type=Path, default=ROOT / 'frontend/public/data/jobs')
    args = parser.parse_args()
    export(args.database, args.output)
