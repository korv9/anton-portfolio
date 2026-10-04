import numpy as np
import pandas as pd
import pytest

from ml.jobs.features import clean_descriptions, fuse, segments
from ml.jobs.feature_experiment import align_labels, consensus


def test_cleanup_removes_repeated_marketing_preserves_technical_negation_and_all_ads():
    jobs = pd.DataFrame({'job_id': [str(i) for i in range(9)], 'text_hash': [str(i) for i in range(9)],
                         'description': ['<p>Java är inte ett krav.</p><p>Vi arbetar tillsammans för att skapa en fantastisk framtid.</p><p>Friskvårdsbidrag och tjänstepension.</p><p>Kontakta person@example.org.</p>'] * 9,
                         'skills': [['Java']] * 9})
    cleaned, audit, report = clean_descriptions(jobs)
    assert len(cleaned) == len(jobs)
    assert all('Java är inte ett krav.' in text for text in cleaned)
    assert all('fantastisk framtid' not in text and 'Friskvårdsbidrag' not in text for text in cleaned)
    assert all('person@example.org' not in text for text in cleaned)
    assert all(text.strip() for text in cleaned)
    assert report['ads_with_removed_segments'] == 9
    assert len(audit) == 9
    assert segments('<p>C++ and C#.</p><p>.NET</p>') == ['C++ and C#.', '.NET']


def test_cleanup_does_not_turn_duplicate_ads_into_independent_document_frequency():
    jobs = pd.DataFrame({'job_id': [str(i) for i in range(20)], 'text_hash': ['same'] * 20,
                         'description': ['Working together to build reliable services with our customers.'] * 20,
                         'skills': [[]] * 20})
    cleaned, _, report = clean_descriptions(jobs)
    assert report['ads_with_removed_segments'] == 0
    assert len(cleaned) == 20


def test_fusion_uses_normalised_blocks_and_squared_weights_with_missing_skills():
    blocks = {'semantic': np.array([[100., 0.], [10., 0.]]),
              'skill': np.array([[1., 0.], [0., 1.]])}
    matrix = fuse(blocks, {'semantic': .75, 'skill': .25})
    np.testing.assert_allclose(np.linalg.norm(matrix, axis=1), 1.)
    assert matrix[0] @ matrix[1] == pytest.approx(.75)
    blocks['skill'][1] = 0
    np.testing.assert_allclose(np.linalg.norm(fuse(blocks, {'semantic': .75, 'skill': .25}), axis=1), 1.)
    with pytest.raises(ValueError):
        fuse(blocks, {'semantic': .5, 'skill': .2})


def test_consensus_aligns_permuted_ids_requires_two_votes_and_can_recover_noise():
    labels = [np.array([0, 0, 1, 1, -1, -1]),
              np.array([10, 10, 20, 20, 10, -1]),
              np.array([5, 5, 8, 8, 5, 8])]
    ids, support = consensus(labels)
    np.testing.assert_array_equal(ids, [0, 0, 1, 1, 0, -1])
    np.testing.assert_allclose(support, [1, 1, 1, 1, 2 / 3, 0])
    ambiguous = align_labels(np.array([0, 0, 1, 1]), np.array([4, 4, 4, 4]))
    np.testing.assert_array_equal(ambiguous, [-1, -1, -1, -1])


def test_profile_does_not_name_a_cluster_from_a_rare_high_lift_mention():
    from ml.jobs.profile import profiles
    frame = pd.DataFrame({'job_id': [str(i) for i in range(80)],
                          'cluster_id': [0] * 40 + [1] * 40,
                          'skills': [['PHP']] * 4 + [[]] * 76,
                          'title': [f'Developer title {i}' for i in range(80)],
                          'role_family': ['Software Developer'] * 80,
                          'seniority': ['unspecified'] * 80, 'published_year': [2025] * 80,
                          'region': ['Stockholm'] * 80, 'cluster_probability': [1.] * 80})
    result = profiles(frame)[0]
    assert result['top_skills'][0]['skill'] == 'PHP'
    assert result['top_skills'][0]['lift'] > 1.5
    assert result['cluster_label'] == 'Mixed tech advertisements'
    assert result['skill_observation_share'] == .1


def test_projection_diagnostics_keep_original_and_feature_neighbours_separate():
    from ml.jobs.evaluate import evaluate
    from sklearn.preprocessing import normalize
    vectors = normalize(np.random.default_rng(42).normal(size=(30, 5)))
    labels = np.array([0] * 15 + [1] * 15)
    jobs = pd.DataFrame({'cluster_id': labels, 'role_family': ['Software Developer'] * 30})
    same = evaluate(vectors, vectors, vectors[:, :2], labels, np.ones(30), jobs, feature_vectors=vectors)
    assert same['feature_trustworthiness'] == pytest.approx(same['trustworthiness'])
    moved = evaluate(vectors, vectors, vectors[:, :2], labels, np.ones(30), jobs, feature_vectors=np.roll(vectors, 1, axis=0))
    assert moved['trustworthiness'] == same['trustworthiness']
    assert moved['feature_trustworthiness'] < moved['trustworthiness']
