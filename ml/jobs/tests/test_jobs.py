import importlib.util
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from ml.jobs.prepare import semantic_text, text_hash, load_jobs
from ml.jobs.pipeline import validate_output
from ml.jobs.embeddings import embed
from ml.jobs.profile import profiles


def test_semantic_input_ignores_order_and_whitespace():
    first = semantic_text(' Data\nEngineer ', 'Swedish  och English', ['SQL', 'Python', 'SQL'])
    second = semantic_text('Data Engineer', 'Swedish och English', ['Python', 'SQL'])
    assert first == second
    assert text_hash(first) == text_hash(second)
    assert text_hash(first) != text_hash(first + ' Azure')
    assert 'Swedish och English' in first


def test_output_rejects_duplicate_ids_invalid_confidence_and_coordinates():
    frame = pd.DataFrame({'job_id': ['a', 'b'], 'cluster_id': [0, -1],
                          'cluster_probability': [.8, 0], 'is_noise': [False, True],
                          'umap_x': [1., 2.], 'umap_y': [3., 4.]})
    validate_output(frame)
    for column, value in [('job_id', 'a'), ('cluster_probability', 1.2), ('umap_x', np.nan), ('is_noise', False)]:
        broken = frame.copy()
        broken.loc[1, column] = value
        with pytest.raises(ValueError):
            validate_output(broken)


def test_embedding_cache_reuses_text_and_invalidates_model_revision(tmp_path, monkeypatch):
    import sentence_transformers
    calls = []
    class Tokenizer:
        def num_special_tokens_to_add(self): return 2
        def encode(self, text, **kwargs): return list(range(len(text.split())))
        def decode(self, tokens, **kwargs): return ' '.join(map(str, tokens))
    class Model:
        max_seq_length = 32
        tokenizer = Tokenizer()
        def __init__(self, *args, **kwargs): calls.append('load')
        def encode(self, chunks, **kwargs): return np.tile([1., 0., 0.], (len(chunks), 1))
    monkeypatch.setattr(sentence_transformers, 'SentenceTransformer', Model)
    jobs = pd.DataFrame({'job_id': ['a'], 'text': ['some real looking test text'], 'text_hash': ['hash']})
    original, info = embed(jobs, tmp_path, 'test-model', 'revision-a')
    again, info = embed(jobs, tmp_path, 'test-model', 'revision-a')
    assert calls == ['load']
    assert info['reused'] == 1
    np.testing.assert_array_equal(original, again)
    embed(jobs, tmp_path, 'test-model', 'revision-b')
    assert calls == ['load', 'load']
    changed = jobs.assign(text_hash='changed')
    embed(changed, tmp_path, 'test-model', 'revision-b')
    assert len(calls) == 3


def test_source_selection_uses_enriched_ads_and_existing_skills(tmp_path):
    import duckdb
    database = tmp_path / 'jobs.duckdb'
    with duckdb.connect(str(database)) as con:
        con.execute('create schema silver; create schema gold')
        con.execute('''create table silver.int_job_ads_enriched as select
            i::varchar as job_id, 'Developer' as title, 'Swedish English content' as description,
            '[]' as required_skills, case when i = 20 then 'Other' else 'Software Developer' end as role_family,
            'unspecified' as seniority, 'Developer' as occupation, 'Stockholm' as region,
            timestamp '2025-01-01' as published_at, 'Permanent' as employment_type,
            'historical' as source_kind from range(21) t(i)''')
        con.execute("create table gold.bridge_job_skills as select '0' as job_id, 'Python' as skill")
    jobs, size = load_jobs(database)
    assert size == 20
    assert jobs[jobs.job_id == '0'].iloc[0].skills == ['Python']
    assert 'Other' not in set(jobs.role_family)
    with duckdb.connect(str(database)) as con:
        con.execute("update silver.int_job_ads_enriched set source_kind = 'fixture'")
    with pytest.raises(ValueError, match='Fixture'):
        load_jobs(database)


def test_profile_noise_and_role_crosstab():
    frame = pd.DataFrame({'job_id': ['a', 'b', 'c'], 'cluster_id': [0, 0, -1],
                          'skills': [['Python'], ['Python'], []], 'title': ['Developer'] * 3,
                          'role_family': ['Software Developer', 'Data Engineer', 'Software Developer'],
                          'seniority': ['junior', 'senior', 'unspecified'],
                          'published_year': [2025] * 3, 'region': ['Stockholm'] * 3,
                          'cluster_probability': [.9, .8, 0]})
    result = profiles(frame)
    assert result[0]['cluster_label'] == 'Unassigned / noise'
    assert result[1]['job_count'] == 2
    assert sum(r['count'] for r in result[1]['role_distribution']) == 2
    assert result[1]['junior_share'] == .5


def test_export_contains_only_delivery_fields_and_run_consistency(tmp_path):
    import duckdb
    import json
    root = Path(__file__).resolve().parents[3]
    spec = importlib.util.spec_from_file_location('cluster_export', root / 'platform/publish/export_job_clusters.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    database = tmp_path / 'delivery.duckdb'
    report = {'run_id': 'test', 'generated_at': '2026-10-04', 'source_size': 1, 'sampled': False,
              'source_kinds': ['historical'], 'config': {}, 'diagnostics': {'dataset_size': 1},
              'parameter_comparisons': [], 'versions': {}}
    with duckdb.connect(str(database)) as con:
        con.execute('create schema gold; create schema raw')
        con.execute('''create table gold.mart_job_clusters as select 'a' as job_id, 'test' as run_id,
                    0 as cluster_id, 'Python' as cluster_label, .8 as cluster_probability,
                    false as is_noise, 1.0 as umap_x, 2.0 as umap_y, 'Data Engineer' as role_family,
                    'junior' as seniority, 2025 as published_year, 'Stockholm' as region,
                    'Engineer' as title, ['Python'] as skills''')
        con.execute('''create table gold.dim_job_clusters as select 'test' as run_id, 0 as cluster_id,
                    '[]' as top_titles, '[]' as top_skills, '[]' as role_distribution,
                    '[]' as regions, '[]' as years, '[]' as representative_ads''')
        con.execute('create table raw.job_cluster_runs (report_json varchar)')
        con.execute('insert into raw.job_cluster_runs values (?)', [json.dumps(report)])
    output = tmp_path / 'export'
    module.export(database, output)
    point = json.loads((output / 'clusters/test/points-0.json').read_text())['points'][0]
    assert 'description' not in point and 'embedding' not in point
    assert point['skills'] == ['Python']
    with duckdb.connect(str(database)) as con:
        con.execute("update gold.mart_job_clusters set run_id = 'other'")
    with pytest.raises(ValueError, match='differ'):
        module.export(database, output)
