import numpy as np
import pandas as pd

from ml.atlas import links, space


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
    best = {r['from']: r['to'] for r in links.strongest(rows, top=1)}
    assert best == {'an': 'bn', 'as': 'bs'}
