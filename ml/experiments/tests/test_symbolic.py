"""Symbol Lab experiments: duplicates and leaks in the split, symbol masking, rejection of a failing candidate."""
import numpy as np
import pandas as pd

from ml.experiments import accept, contract
from ml.experiments import symbolic_data as data
from ml.experiments import symbolic_fit as sf
from ml.experiments.registry import Registry


def frame():
    rows = [  # book a and c share a reprint with different punctuation; b and d share a near-identical text
        ('o1', 'The serpent spoke, softly.', 'a'), ('o2', 'An eagle rose.', 'a'),
        ('o3', 'the serpent spoke softly', 'c'), ('o4', 'Fire burned.', 'b'),
        ('o5', 'Fire burned!', 'd'), ('o6', 'A tree grew.', 'e'), ('o7', 'Water ran.', 'f'), ('o8', 'Sun set.', 'g')]
    out = pd.DataFrame(rows, columns=['occurrence_id', 'context', 'document_id'])
    return data.with_hashes(out)


def test_normalised_reprints_and_near_pairs_stay_on_one_side():
    f = frame()
    assert f.text_hash[0] != f.text_hash[2] and f.norm_hash[0] == f.norm_hash[2]
    dup = data.duplicates(f)
    assert dup['text_hash']['groups_across_books'] == 0 and dup['norm_hash']['groups_across_books'] == 2
    near = np.array([[3, 4]])
    for seed in range(10):
        mask, report = data.split_side(f, near, seed=seed)
        assert report['leaks'] == [] and report['near_identical_pairs_across_sides'] == 0
        assert mask[0] == mask[2] and mask[3] == mask[4]


def test_near_pairs_only_across_books():
    v = np.array([[1, 0], [1, 0], [0.999, 0.045], [0, 1]], dtype=np.float32)
    v /= np.linalg.norm(v, axis=1, keepdims=True)
    pairs = data.near_pairs(v, np.array(['a', 'a', 'b', 'c']), 0.95)
    assert sorted(map(tuple, pairs.tolist())) == [(0, 2), (1, 2)]


def test_masking_replaces_the_alias_as_a_whole_word():
    assert data.mask_symbol('The Serpent and the serpentine serpent.', 'serpent') == \
        'The [SYMBOL] and the serpentine [SYMBOL].'
    f = pd.DataFrame({'context': ['A raven flew. Ravens cry.'], 'matched_term': ['raven'], 'sentence': ['']})
    assert data.text_of(f, 'masked') == ['A [SYMBOL] flew. Ravens cry.']


def test_book_specific_terms_flags_one_book_vocabulary():
    texts = ['achilles fought troy'] * 6 + ['river water flows'] * 3 + ['river water runs'] * 3
    books = ['iliad'] * 6 + ['x', 'y', 'z'] * 2
    labels = np.array([0] * 6 + [1] * 6)
    terms, summary = sf.terms(texts, labels, np.array(books), top=2)
    assert set(terms[0]) <= {'achilles', 'fought', 'troy'} and set(terms[1]) == {'river', 'water'}
    assert summary['book_specific_term_share'] == 0.5


def make_run(metrics, min_cluster_size, seeds=(10, 11)):
    pipeline = {'text': {'version': 't'}, 'embedding': {'model': 'm', 'revision': 'r'},
                'representation': {'kind': 'raw'}, 'reduction': {'kind': 'none'},
                'clustering': {'method': 'hdbscan', 'min_cluster_size': min_cluster_size}}
    run = {'domain': 'symbolic', 'question': 'q', 'corpus': 'synthetic', 'sample': {}, 'dataset_version': 'd',
           'pipeline': pipeline, 'seeds': list(seeds), 'role': 'evaluation', 'metrics': metrics,
           'resources': {}, 'limitations': ['synthetic'], 'created_at': '2026-10-29T00:00:00Z'}
    run['run_id'] = contract.run_id('symbolic', 'd', pipeline, list(seeds), 'evaluation')
    return run


def test_candidate_failing_a_frozen_criterion_is_rejected(tmp_path):
    rules, sha = accept.criteria('symbolic')
    base = {'noise_share': 0.5, 'cluster_count': 60, 'seed_stability': {'ari_mean': 0.6},
            'separation_representation': 0.05,
            'dominance': {'book': {'weighted_top_share': 0.5}, 'symbol': {'weighted_top_share': 0.3}}}
    champion = make_run(base, 20)
    # Less book-dominated (a gain) but symbol-word dominance much worse: must fail.
    worse = make_run({**base, 'dominance': {'book': {'weighted_top_share': 0.3},
                                        'symbol': {'weighted_top_share': 0.5}}}, 50)
    registry = Registry('symbolic', tmp_path)
    registry.register(champion, 'champion')
    registry.register(worse, 'candidate')
    report = accept.check(worse, registry.champion(), rules, sha)
    assert not report['passed'] and report['failed'] == ['symbol-word dominance not worse']
    assert registry.decide(worse['run_id'], report) == 'rejected'
    assert registry.champion()['run_id'] == champion['run_id']
