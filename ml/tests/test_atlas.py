import numpy as np
import pandas as pd

from ml.atlas import links, space, stability


def frame(corpora, groups, units):
    return pd.DataFrame({'corpus': corpora, 'language': 'sv', 'group': groups, 'unit': units})


def test_whitening_removes_each_corpus_offset():
    rng = np.random.default_rng(0)
    a = rng.normal(size=(200, 8)) + 5      # corpus a sits far from corpus b
    b = rng.normal(size=(200, 8)) - 5
    f = frame(['a'] * 200 + ['b'] * 200, 'g', range(400))
    raw = space.normalise(np.vstack([a, b]))
    aligned = space.whiten(f, np.vstack([a, b]))
    assert np.allclose(np.linalg.norm(aligned, axis=1), 1)
    assert space.purity(f, raw)['overall'] > 0.99
    assert space.purity(f, aligned)['overall'] < 0.7


def test_a_group_links_to_the_group_it_sits_beside():
    rng = np.random.default_rng(1)
    north, south = np.eye(4)[0], np.eye(4)[1]
    points = np.vstack([north + rng.normal(0, .1, (60, 4)), south + rng.normal(0, .1, (60, 4)),
                        north + rng.normal(0, .1, (60, 4)), south + rng.normal(0, .1, (60, 4))])
    f = frame(['a'] * 120 + ['b'] * 120, ['an'] * 60 + ['as'] * 60 + ['bn'] * 60 + ['bs'] * 60,
              [f'u{i // 6}' for i in range(240)])
    rows = links.affinity(f, space.normalise(points), 'a', 'b', iterations=50)
    best = {r['from']: r['to'] for r in links.strongest(links.adjust(rows), top=1)}
    assert best == {'an': 'bn', 'as': 'bs'}


def test_a_group_with_one_unit_is_resampled_in_blocks():
    f = frame(['a'] * 50, ['solo'] * 45 + ['wide'] * 5, ['w'] * 45 + [f'u{i}' for i in range(5)])
    units = links.resampling_units(f)
    assert len(set(units[:45])) == 3          # 45 passages of one work, blocks of 20
    assert list(units[45:]) == [f'u{i}' for i in range(5)]


def test_no_link_survives_when_the_groups_are_shuffled():
    rng = np.random.default_rng(2)
    points = space.normalise(rng.normal(size=(400, 8)))
    f = frame(['a'] * 200 + ['b'] * 200, [f'a{i % 4}' for i in range(200)] + [f'b{i % 4}' for i in range(200)],
              [f'u{i // 5}' for i in range(400)])
    rows = links.adjust(links.affinity(f, points, 'a', 'b', iterations=100))
    assert not any(links.clear(r) for r in rows)


def test_benjamini_hochberg_matches_the_textbook_values():
    rows = links.adjust([{'p': p} for p in (0.01, 0.04, 0.03, 0.2)])
    assert [round(r['q'], 4) for r in rows] == [0.04, 0.0533, 0.0533, 0.2]


def test_a_cluster_found_again_by_every_seed_is_stable():
    reference = np.array([0] * 50 + [1] * 50 + [-1] * 10)
    again = np.array([3] * 50 + [4] * 50 + [-1] * 10)
    split = np.array([3] * 50 + list(np.arange(50) % 5 + 5) + [-1] * 10)
    result = stability.stability([reference, again, again, split, split])
    assert result['stable'] == [0]
    assert result['agree'] == {0: 4, 1: 2}
