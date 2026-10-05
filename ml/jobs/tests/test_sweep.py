import numpy as np
import pytest

from ml.jobs.sweep import structure, separation, score, cached_embeddings, analysis_metadata_sha


def test_structure_penalises_real_employer_majorities_but_not_missing_names():
    labels = np.array([0, 0, 0, 1, 1, -1])
    result = structure(labels, np.array(['A', 'A', 'B', '', '', 'A']))
    assert result['cluster_count'] == 2
    assert result['largest_cluster_share'] == .5
    assert result['noise_share'] == pytest.approx(1 / 6)
    assert result['employer_majority_share'] == .6
    assert result['weighted_top_employer_share'] == .4
    assert structure(np.full(6, -1), np.array(['A'] * 6))['cluster_count'] == 0


def test_original_separation_excludes_noise_and_handles_undefined_clusters():
    from sklearn.metrics import pairwise_distances, silhouette_score
    vectors = np.array([[0., 0.], [.1, 0.], [3., 3.], [3.1, 3.], [1., 1.]])
    distances = pairwise_distances(vectors)
    labels = np.array([0, 0, 1, 1, -1])
    assert separation(labels, distances, np.arange(5)) == pytest.approx(silhouette_score(vectors[:4], labels[:4]))
    assert separation(np.zeros(5), distances, np.arange(5)) is None
    assert score({'cluster_count': 0, 'embedding_silhouette': None}) == -10


def test_sweep_refuses_missing_cache_instead_of_download_or_fabrication(tmp_path):
    import pandas as pd
    with pytest.raises(FileNotFoundError):
        cached_embeddings(pd.DataFrame({'text_hash': ['missing']}), tmp_path, 'unknown', 'commit')


def test_sweep_review_identity_changes_when_role_or_employer_changes():
    import pandas as pd
    frame = pd.DataFrame({'job_id': ['a'], 'title': ['Developer'], 'skills': [['Python']],
                          'role_family': ['Software Developer'], 'seniority': ['senior'],
                          'published_year': [2025], 'region': ['Stockholm']})
    original = analysis_metadata_sha(frame, np.array(['Employer A']))
    assert original != analysis_metadata_sha(frame, np.array(['Employer B']))
    assert original != analysis_metadata_sha(frame.assign(role_family='Data Engineer'), np.array(['Employer A']))
