"""The shared experiment core: contract, splits, registry, acceptance, checkpoints, export."""
import json

import numpy as np
import pytest
import yaml

from ml.experiments import accept, contract, export, splits
from ml.experiments import evaluate as ev
from ml.experiments.registry import Registry
from ml.experiments.runtime import Checkpoints, measure


def make_run(domain='jobs', seeds=(0, 1), clustering=None, metrics=None, role='evaluation'):
    pipeline = {'text': {'version': 't1'}, 'embedding': {'model': 'm', 'revision': 'r1'},
                'representation': {'kind': 'raw'}, 'reduction': {'kind': 'none'},
                'clustering': clustering or {'method': 'kmeans', 'k': 3}}
    run = {'domain': domain, 'question': 'q', 'corpus': 'synthetic test fixture', 'sample': {'n': 10},
           'dataset_version': 'd1', 'pipeline': pipeline, 'seeds': list(seeds), 'role': role,
           'metrics': metrics or {'noise_share': 0.1, 'cluster_count': 3, 'seed_stability': {'ari_mean': 0.7}},
           'resources': {'seconds': 1}, 'limitations': ['synthetic'], 'created_at': '2026-10-29T00:00:00Z'}
    run['run_id'] = contract.run_id(domain, 'd1', pipeline, list(seeds), role)
    return run


def test_contract_rejects_unpinned_model_and_wrong_id():
    run = make_run()
    assert contract.validate(run) == []
    run['pipeline']['embedding']['revision'] = None
    problems = contract.validate(run)
    assert any('revision' in p for p in problems) and any('run_id' in p for p in problems)
    assert contract.validate({'domain': 'jobs'})


def test_split_keeps_duplicates_and_groups_on_one_side():
    groups = ['a', 'a', 'b', 'c', 'd', 'e', 'f', 'g']
    texts = ['x', 'y', 'z', 'x', 'w', 'v', 'u', 't']  # 'x' links group a with group c
    mask = splits.split(groups, texts, 0.5, seed=1)
    assert splits.check(mask, groups, texts) == []
    assert mask[0] == mask[1] == mask[3]


def test_dominance_null_and_structure():
    labels = np.array([0] * 50 + [1] * 50 + [-1] * 10)
    field = np.array(['a'] * 50 + ['b'] * 50 + ['c'] * 10)
    d = ev.dominance(labels, field, nulls=50)
    assert d['weighted_top_share'] == 1.0 and d['null_top_share_p95'] < 0.7
    s = ev.structure(labels)
    assert s['cluster_count'] == 2 and abs(s['noise_share'] - 10 / 110) < 1e-9
    assert ev.seed_stability([labels, labels])['ari_mean'] == 1.0


def test_registry_promote_reject_rollback(tmp_path):
    reg = Registry('jobs', tmp_path)
    first = make_run(seeds=(0,))
    reg.register(first, 'champion', 'existing published model')
    second = make_run(seeds=(0, 1))
    reg.register(second)
    with pytest.raises(ValueError):
        reg.promote(second['run_id'], 'no report')
    reg.decide(second['run_id'], {'passed': True, 'failed': []})
    reg.promote(second['run_id'], 'better')
    assert reg.champion()['run_id'] == second['run_id']
    assert reg.rollback('export broke') == first['run_id']
    assert reg.champion()['run_id'] == first['run_id']
    third = make_run(seeds=(0, 1, 2))
    reg.register(third)
    assert reg.decide(third['run_id'], {'passed': False, 'failed': ['seed ARI']}) == 'rejected'
    assert [h['action'] for h in reg.load()['history']][-1] == 'reject'


def test_acceptance_rejects_candidate_that_misses_a_rule(tmp_path):
    (tmp_path / 'jobs.yaml').write_text(yaml.safe_dump({'frozen_at': '2026-10-29', 'criteria': [
        {'name': 'stable', 'metric': 'seed_stability.ari_mean', 'at_least': 0.6},
        {'name': 'noise', 'metric': 'noise_share', 'direction': 'lower', 'not_worse_than_champion': 0.05},
        {'name': 'gain', 'any_of': [{'metric': 'seed_stability.ari_mean', 'better_than_champion': 0.05}]}]}))
    rules, sha = accept.criteria('jobs', tmp_path)
    champ = make_run(metrics={'noise_share': 0.1, 'cluster_count': 3, 'seed_stability': {'ari_mean': 0.7}})
    worse = make_run(seeds=(5,), metrics={'noise_share': 0.3, 'cluster_count': 3, 'seed_stability': {'ari_mean': 0.8}})
    report = accept.check(worse, champ, rules, sha)
    assert not report['passed'] and report['failed'] == ['noise']
    better = make_run(seeds=(6,), metrics={'noise_share': 0.1, 'cluster_count': 3, 'seed_stability': {'ari_mean': 0.8}})
    assert accept.check(better, champ, rules, sha)['passed']
    (tmp_path / 'open.yaml').write_text(yaml.safe_dump({'criteria': []}))
    with pytest.raises(ValueError):
        accept.criteria('open', tmp_path)


def test_checkpoints_resume_and_measure(tmp_path):
    cp = Checkpoints(tmp_path / 'cp')
    assert not cp.done('a')
    cp.put('a', {'x': 1})
    assert Checkpoints(tmp_path / 'cp').get('a') == {'x': 1}
    with measure(tmp_path) as used:
        sum(range(1000))
    assert used['seconds'] >= 0 and used['peak_rss_mb'] > 0


def test_export_lists_status_and_caps_text(tmp_path):
    reg = Registry('jobs', tmp_path / 'reg')
    run = make_run()
    reg.register(run, 'champion', 'seed')
    entry = reg.load()['runs'][run['run_id']]
    export.run_file(entry, [['a', 0.1, 0.2, 0]] * 5000,
                    [{'cluster': 0, 'size': 5, 'examples': [{'id': 'a', 'text': 'w ' * 500, 'source': {}}]}],
                    tmp_path / 'out')
    export.index(tmp_path / 'out', tmp_path / 'reg')
    body = json.loads((tmp_path / 'out' / 'runs' / f"{run['run_id']}.json").read_text())
    assert len(body['map']['points']) == export.MAX_POINTS
    assert len(body['groups'][0]['examples'][0]['text']) <= export.EXCERPT
    index = json.loads((tmp_path / 'out' / 'index.json').read_text())
    assert index['domains']['jobs']['champion'] == run['run_id']


def test_embedding_cache_reuses_and_invalidates(tmp_path):
    from ml.experiments import embed
    calls = []

    def encoder(xs):
        calls.append(len(xs))
        return np.ones((len(xs), 4))

    texts = ['a', 'b', 'a']
    hashes = [embed.text_hash(t, 'v1') for t in texts]
    v = embed.embed(texts, hashes, 'm', 'r1', 'v1', root=tmp_path, encoder=encoder)
    assert v.shape == (3, 4) and calls == [2]
    embed.embed(texts, hashes, 'm', 'r1', 'v1', root=tmp_path, encoder=encoder)
    assert calls == [2]  # all cached
    embed.embed(texts, hashes, 'm', 'r2', 'v1', root=tmp_path, encoder=encoder)
    embed.embed(texts, hashes, 'm', 'r1', 'v2', root=tmp_path, encoder=encoder)
    assert calls == [2, 2, 2]  # a new revision or text version starts a new cache
    with pytest.raises(ValueError):
        embed.embed(texts, hashes, 'm', '', 'v1', root=tmp_path, encoder=encoder)


def test_embedding_resumes_after_deadline(tmp_path):
    from ml.experiments import embed

    class Once:
        n = 0

        def expired(self):
            self.n += 1
            return self.n > 1

    texts = [str(i) for i in range(10)]
    hashes = [embed.text_hash(t, 'v') for t in texts]
    with pytest.raises(TimeoutError):
        embed.embed(texts, hashes, 'm', 'r', 'v', batch=4, root=tmp_path, encoder=lambda xs: np.zeros((len(xs), 2)),
                    deadline=Once())
    seen = []
    embed.embed(texts, hashes, 'm', 'r', 'v', batch=4, root=tmp_path,
                encoder=lambda xs: seen.append(len(xs)) or np.zeros((len(xs), 2)))
    assert sum(seen) == 6  # the first batch of four was kept


def test_rollback_can_keep_a_mistaken_champion_as_candidate(tmp_path):
    reg = Registry('jobs', tmp_path)
    first, second = make_run(seeds=(0,)), make_run(seeds=(0, 1))
    reg.register(first, 'champion', 'published')
    reg.register(second)
    reg.decide(second['run_id'], {'passed': True, 'failed': []})
    reg.promote(second['run_id'], 'passed')
    reg.rollback('promoted by mistake', demote_to='candidate')
    state = reg.load()['runs']
    assert state[second['run_id']]['status'] == 'candidate' and state[first['run_id']]['status'] == 'champion'


def test_rollback_skips_rejected_and_reinstate_withdraws_invalid(tmp_path):
    reg = Registry('jobs', tmp_path)
    a, b, c = make_run(seeds=(0,)), make_run(seeds=(0, 1)), make_run(seeds=(0, 1, 2))
    reg.register(a, 'champion', 'published')
    for run in (b, c):
        reg.register(run)
    reg.decide(b['run_id'], {'passed': True, 'failed': []})
    reg.promote(b['run_id'], 'passed')
    reg.reinstate(b['run_id'], c['run_id'], 'champion built on invalid text')
    runs = reg.load()['runs']
    assert runs[b['run_id']]['status'] == 'rejected' and runs[c['run_id']]['status'] == 'champion'
    # Rolling back from c returns to a, never to the rejected b.
    assert reg.rollback('test') == a['run_id']
