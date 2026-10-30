"""Replik experiment: cleaning keeps negations, masking hides names, splits keep debates whole,
and a candidate that fails a frozen criterion is rejected."""
import numpy as np
import pandas as pd
import pytest

from ml.experiments import accept, debates_data as data, splits
from ml.experiments.registry import Registry
from ml.experiments.tests.test_core import make_run

NAMES = data.name_pattern(['Magdalena Andersson', 'Ulf Kristersson', 'Anna'])


def test_masking_never_removes_negations():
    text = ('Herr talman! Statsministern säger inte sanningen. Ulf Kristersson har aldrig, ingen gång, '
            'varken i år eller i fjol, inga svar och inget förslag; icke heller Moderaterna.')
    out = data.mask(text, NAMES)
    assert data.negation_counts(out) == data.negation_counts(text)
    assert all(n in data.negation_counts(text) for n in data.NEGATIONS)


def test_masking_replaces_names_parties_and_address():
    out = data.mask('Fru talman! Jag vill fråga Magdalena Anderssons parti, Socialdemokraterna, och SD. '
                    'Kristersson svarade statsministern.', NAMES)
    for gone in ('Magdalena', 'Andersson', 'Socialdemokraterna', 'SD', 'Kristersson', 'talman', 'statsministern'):
        assert gone not in out
    assert '[NAMN]' in out and '[PARTI]' in out and '[TILLTAL]' in out
    # Ordinary words that only start like a party name stay.
    assert data.mask('En liberalisering av handeln.', NAMES) == 'En liberalisering av handeln.'


def test_mask_raises_if_a_negation_would_change():
    with pytest.raises(AssertionError):
        data.mask('Det är inte sant.', __import__('re').compile(r'\binte\b'))


def test_templates_share():
    texts = pd.Series(['jag tror att det är viktigt att vi gör mer',
                       'jag tror att det är viktigt att vi gör annat', 'helt annan början här'])
    assert data.templates(texts)['share_sharing_opening'] == pytest.approx(2 / 3)


def test_split_keeps_whole_debates_on_one_side():
    rng = np.random.default_rng(0)
    debates = np.repeat([f'd{i}' for i in range(40)], 25)
    hashes = [f'h{i}' for i in range(len(debates))]
    hashes[3] = hashes[600]  # one repeated passage across two debates joins them
    mask = splits.split(debates, hashes, 0.5, seed=int(rng.integers(100)))
    assert splits.check(mask, debates, hashes) == []
    frame = pd.DataFrame({'d': debates, 's': mask})
    assert (frame.groupby('d').s.nunique() == 1).all()
    assert mask[3] == mask[600]
    assert 0.3 < mask.mean() < 0.7


def test_speaker_centring_follows_champion_rule():
    obs = pd.DataFrame({'observation_id': range(8), 'speaker': ['a'] * 6 + ['b'] * 2,
                        'debate_id': ['x', 'y', 'x', 'y', 'x', 'y', 'x', 'x']})
    groups = data.centring_groups(obs, 'speaker')
    assert list(groups) == ['a'] * 6 + [''] * 2  # b has too few passages and one debate
    vectors = np.eye(8, dtype=np.float32)
    out = data.centre(vectors, groups)
    np.testing.assert_allclose(out[6], vectors[6])


def test_failing_candidate_is_rejected(tmp_path):
    rules, sha = accept.criteria('debates')
    champ = make_run('debates', seeds=(10, 11), metrics={
        'noise_share': 0.3, 'cluster_count': 30, 'seed_stability': {'ari_mean': 0.7},
        'separation_representation': 0.05,
        'dominance': {'party': {'ami': 0.04}, 'speaker': {'ami': 0.1}, 'debate': {'weighted_top_share': 0.2}}})
    worse = make_run('debates', seeds=(10, 12), metrics={
        'noise_share': 0.3, 'cluster_count': 30, 'seed_stability': {'ari_mean': 0.8},
        'separation_representation': 0.05,
        'dominance': {'party': {'ami': 0.09}, 'speaker': {'ami': 0.1}, 'debate': {'weighted_top_share': 0.2}}})
    reg = Registry('debates', tmp_path)
    reg.register(champ, 'champion')
    reg.register(worse, 'candidate')
    report = accept.check(worse, champ, rules, sha)
    assert not report['passed'] and report['failed'] == ['party not more aligned']
    assert reg.decide(worse['run_id'], report) == 'rejected'
    with pytest.raises(ValueError):
        reg.promote(worse['run_id'], 'should fail')
    assert reg.champion()['run_id'] == champ['run_id']
