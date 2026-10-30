"""Job-ad clustering MLOps: input checks, dedup and leaks, cache, resume, gating, rollback, linkage, assignment."""
import json

import numpy as np
import pandas as pd
import pytest

from ml.experiments import export, jobs_data, jobs_mlops, jobs_model, splits
from ml.experiments import jobs_experiments as ex
from ml.experiments.registry import Registry
from ml.experiments.runtime import Checkpoints

TOPICS = {'data': 'python spark pipeline lakehouse dbt warehouse etl airflow',
          'web': 'react typescript frontend css browser component javascript accessibility',
          'ops': 'kubernetes terraform azure monitoring linux network incident cloud'}


def ad(i, topic, employer, **extra):
    words = TOPICS[topic].split()
    rng = np.random.default_rng(i)
    body = ' '.join(rng.choice(words, 30))
    template = f'{employer} är ett ledande bolag som alltid sätter människan i centrum och erbjuder trygga villkor.'
    base = {'id': str(i), 'headline': f'{topic} roll {i}', 'description': f'{body}\n{template}', 'employer': employer,
            'content_hash': f'h{i}', 'duplicate_key': f'k{i}', 'published': f'2026-09-{1 + i % 28:02d}T00:00:00',
            'duplicate_of': None, 'removed_at': None, 'occupation': topic, 'must_have': [topic]}
    return {**base, **extra}


def corpus(n=60):
    return [ad(i, list(TOPICS)[i % 3], f'Bolag{i % 12} AB') for i in range(n)]


PIPE = {**ex.pipeline('clean', 'tfidf-lsa', {'method': 'kmeans', 'k': 3}), 'reduction': {'kind': 'pca', 'dims': 5}}


def test_missing_empty_and_invalid_input_fail_explicitly(tmp_path):
    with pytest.raises(jobs_data.InputError):
        jobs_data.load_store(tmp_path / 'absent.json')
    for content in ('[]', '{not json', '{"ads": 1}'):
        (tmp_path / 's.json').write_text(content, encoding='utf-8')
        with pytest.raises(jobs_data.InputError):
            jobs_data.load_store(tmp_path / 's.json')
    broken = corpus(20) + [{'id': 'x'}, ad(99, 'web', 'E AB', description='  ')]
    with pytest.raises(jobs_data.InputError):
        jobs_data.validate(broken)  # 2 of 22 invalid is over the 5 % limit
    valid, failures = jobs_data.validate(corpus(40) + [{'id': 'x'}])
    assert len(valid) == 40 and failures[0]['index'] == 40


def test_dedup_templates_masking_and_leak_free_split():
    ads = corpus()
    ads.append(ad(100, 'data', 'Bolag1 AB', content_hash='h1'))            # same content as ad 1
    ads.append(ad(101, 'data', 'Bolag2 AB', duplicate_key='k2'))           # same duplicate_key as ad 2
    ads.append(ad(102, 'web', 'Bolag3 AB', duplicate_of='3'))              # marked by the store
    frame, stats = jobs_data.prepare(ads)
    assert len(frame) == 60 and stats['dedup']['duplicate_of'] == 1 and stats['dedup']['duplicate_key_or_hash'] == 2
    assert stats['templates']['ads_with_template_share'] == 1.0
    assert 'människan i centrum' not in frame.text_clean.iloc[0] and 'människan i centrum' in frame.text_raw.iloc[0]
    assert 'Bolag' not in frame.text_clean.str.cat() and jobs_data.MASK in jobs_data.mask_employer('Hos Bolag7s kunder', 'Bolag7 AB')
    mask = ex.sides(frame)
    assert splits.check(mask, frame.employer, frame.hash_clean) == [] and 0 < mask.mean() < 1


def test_snapshot_diff_detects_new_changed_removed():
    first, stats = jobs_data.prepare(corpus(30))
    snap = jobs_data.snapshot(first, stats)
    later = corpus(33)
    later[0] = ad(0, 'data', 'Bolag0 AB', content_hash='h0-edited', description='helt ny text om spark')
    later[1] = ad(1, 'web', 'Bolag1 AB', removed_at='2026-10-01T00:00:00')
    frame, _ = jobs_data.prepare(later)
    d = jobs_data.diff(snap, frame)
    assert d['new'] == ['30', '31', '32'] and d['changed'] == ['0'] and d['removed'] == ['1']
    assert jobs_data.dataset_version(frame) != snap['dataset_version']


def test_embedding_cache_invalidates_on_model_and_preprocessing_change(tmp_path):
    calls = []
    encoder = lambda xs: calls.append(len(xs)) or np.ones((len(xs), 4))
    texts, hashes = ['a', 'b'], ['ha', 'hb']
    jobs_model.encode(texts, hashes, jobs_data.CLEAN_VERSION, 'minilm-l12', root=tmp_path, encoder=encoder)
    jobs_model.encode(texts, hashes, jobs_data.CLEAN_VERSION, 'minilm-l12', root=tmp_path, encoder=encoder)
    assert calls == [2]
    jobs_model.encode(texts, hashes, jobs_data.RAW_VERSION, 'minilm-l12', root=tmp_path, encoder=encoder)
    jobs_model.encode(texts, hashes, jobs_data.CLEAN_VERSION, 'kblab-sv', root=tmp_path, encoder=encoder)
    assert calls == [2, 2, 2] and len(list(tmp_path.iterdir())) == 3


def test_units_resume_after_interruption(tmp_path):
    ran = []

    def unit(key, fail=False):
        def work():
            if fail and not ran.count('retry'):
                ran.append('retry')
                raise KeyboardInterrupt
            ran.append(key)
            return {'key': key}
        return work

    cp = Checkpoints(tmp_path)
    with pytest.raises(KeyboardInterrupt):
        ex.run_units({'a': unit('a'), 'b': unit('b', fail=True)}, cp)
    assert ex.run_units({'a': unit('a'), 'b': unit('b', fail=True)}, cp) == {'a': {'key': 'a'}, 'b': {'key': 'b'}}
    assert ran == ['a', 'retry', 'b']  # 'a' did not run twice


def test_assignment_abstains_far_from_every_group():
    rng = np.random.default_rng(0)
    centres = np.eye(8)[:3] * 5
    train = np.vstack([c + rng.normal(0, 0.1, (40, 8)) for c in centres])
    pipe = {**PIPE, 'reduction': {'kind': 'none'}}
    model = jobs_model.fit_model(train, pipe, seed=0)
    labels, _ = jobs_model.assign(model, np.vstack([centres[1] + 0.01, -np.ones(8)]))
    assert labels[0] == model['labels'][40] and labels[1] == -1
    assert 0 < model['train_abstain_share'] < 0.2


def make_runs(tmp_path, frame, seeds=(10, 11)):
    sample = {'snapshot': 'snap', 'side': 'evaluation'}
    return jobs_mlops.evaluate_pipeline(frame, PIPE, list(seeds), 'kmeans k3', sample, out=tmp_path)


def test_artifact_links_model_dataset_and_export(tmp_path):
    frame, _ = jobs_data.prepare(corpus())
    run = make_runs(tmp_path / 'out', frame)
    model, manifest = jobs_model.load(jobs_mlops.model_folder(run['run_id'], tmp_path / 'out'))
    assert manifest['run_id'] == run['run_id'] and manifest['dataset_version'] == jobs_data.dataset_version(frame)
    assert run['metrics']['artifact_label_ari'] == 1.0 and manifest['train_ids'] == frame.id.tolist()
    reg = Registry('jobs', tmp_path / 'reg')
    reg.register(run, 'champion', 'test')
    path = export.run_file(reg.load()['runs'][run['run_id']], [[i, 0, 0, 0] for i in frame.id], [], tmp_path / 'pub')
    body = json.loads(path.read_text(encoding='utf-8'))
    assert body['run_id'] == run['run_id'] and body['run']['dataset_version'] == manifest['dataset_version']
    (tmp_path / 'out' / 'models' / run['run_id'] / 'model.joblib').write_bytes(b'tampered')
    with pytest.raises(ValueError):
        jobs_model.load(jobs_mlops.model_folder(run['run_id'], tmp_path / 'out'))


def test_gate_rejects_failing_candidate_promotes_passing_and_rolls_back(tmp_path):
    frame, _ = jobs_data.prepare(corpus())
    champion = make_runs(tmp_path, frame)
    champion['metrics'].update(noise_share=0.3, largest_cluster_share=0.3, cluster_count=6, separation_representation=0.1,
                               seed_stability={'ari_mean': 0.6}, dominance={'employer': {'weighted_top_share': 0.3}})
    reg = Registry('jobs', tmp_path / 'reg')

    def candidate(seeds, **metrics):
        run = ex.make_run(frame, PIPE, seeds, 'evaluation', {**champion['metrics'], **metrics}, {}, 'c', {})
        return run

    failing = candidate([1], cluster_count=3)                                     # under five groups
    passing = candidate([2], seed_stability={'ari_mean': 0.8})                    # a measured gain
    result = jobs_mlops.decide(reg, champion, [failing, passing], promote=True)
    assert result['statuses'][failing['run_id']] == 'rejected' and result['promoted'] == passing['run_id']
    assert reg.champion()['run_id'] == passing['run_id']
    with pytest.raises(ValueError):
        reg.promote(failing['run_id'], 'not allowed')
    restored = jobs_mlops.rollback('test', reg, copy_to=tmp_path / 'copy')
    assert restored == champion['run_id'] and reg.champion()['run_id'] == passing['run_id']  # original untouched
    assert Registry('jobs', tmp_path / 'copy').champion()['run_id'] == champion['run_id']


def test_monitor_flags_drift_and_version_diff_reports_links(tmp_path):
    frame, stats = jobs_data.prepare(corpus())
    run = make_runs(tmp_path, frame)
    old = jobs_model.load(jobs_mlops.model_folder(run['run_id'], tmp_path))
    change = {'since': 'snap', 'new': ['n1', 'n2'], 'changed': [], 'removed': [], 'missing_from_store': []}
    far = -np.tile(old[0]['train_centre'], (2, 1))
    report = jobs_mlops.monitor('assign', old[0], old[1], stats, change, np.array([-1, -1]), far, {}, 'v2', tmp_path)
    assert report['action'] == 'investigate' and len(report['flags']) == 2
    assert report['assignment']['abstained_share'] == 1.0 and report['drift']['shift'] > 1
    other = make_runs(tmp_path, frame.iloc[::-1].reset_index(drop=True), seeds=(12, 13))
    assert other['run_id'] != run['run_id']
    d = jobs_mlops.version_diff(old, jobs_model.load(jobs_mlops.model_folder(other['run_id'], tmp_path)))
    assert d['shared_ads'] == len(frame) and len(d['matched']) == 3 and not d['splits'] and not d['merges']


def test_redaction_markers_never_reach_embedded_text(tmp_path):
    ads = [ad(i, 'data', f'Bolag{i % 4} AB', headline=f'roll {i} [kontaktperson utelämnad]',
              description=f'spark etl {i}\nRing [kontaktuppgift utelämnad] eller [kontaktperson utelämnad]')
           for i in range(12)]
    frame, _ = jobs_data.prepare(ads)
    seen = []
    for text in ex.TEXTS.values():
        jobs_model.encode(frame[text[0]].tolist(), frame[text[1]].tolist(), text[2], 'minilm-l12', root=tmp_path,
                          encoder=lambda xs: seen.extend(xs) or np.ones((len(xs), 2)))
    assert len(seen) == 24 and not any('utelämnad' in t for t in seen)
    assert jobs_data.RAW_VERSION.endswith('-v2') and jobs_data.CLEAN_VERSION.endswith('-v2')
    old = {**PIPE, 'text': {**PIPE['text'], 'version': PIPE['text']['version'].replace('-v2', '-v1')}}
    with pytest.raises(ValueError):
        ex.vectors(frame, old)  # a v1 model cannot embed v2 text under its old label


def test_refresh_rule_only_for_the_champion_pipeline_on_new_data(tmp_path):
    frame, _ = jobs_data.prepare(corpus())
    champion = make_runs(tmp_path, frame)
    champion['metrics'].update(noise_share=0.1, largest_cluster_share=0.3, cluster_count=6, separation_representation=0.1,
                               seed_stability={'ari_mean': 0.8}, dominance={'employer': {'weighted_top_share': 0.3}})
    newer = frame.iloc[:50]
    refresh = ex.make_run(newer, PIPE, [10, 11], 'evaluation', dict(champion['metrics']), {}, 'refresh', {})
    other_pipe = {**PIPE, 'clustering': {'method': 'kmeans', 'k': 6}}
    other = ex.make_run(newer, other_pipe, [10, 11], 'evaluation', dict(champion['metrics']), {}, 'other', {})
    assert jobs_mlops.rule_file(refresh, champion) == 'jobs-refresh' and jobs_mlops.rule_file(other, champion) == 'jobs'
    reg = Registry('jobs', tmp_path / 'reg')
    result = jobs_mlops.decide(reg, champion, [refresh, other], promote=False)
    runs = reg.load()['runs']
    assert result['statuses'][refresh['run_id']] == 'candidate'          # equal metrics pass without a gain
    assert runs[refresh['run_id']]['acceptance']['criteria_file'] == 'configs/experiments/jobs-refresh.yaml'
    assert result['statuses'][other['run_id']] == 'rejected'             # jobs.yaml still asks for a gain
    assert runs[other['run_id']]['acceptance']['failed'] == ['a measured gain']
