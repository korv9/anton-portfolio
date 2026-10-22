"""The three-spaces statistics: the permutation null, neighbours, chance Jaccard and Holm."""
import numpy as np

from ml.three_swedens import centroid, chance_jaccard, clr, distances, holm, jaccard, mantel, nearest, ring_area


def matrices(seed: int, related: bool):
    rng = np.random.default_rng(seed)
    a = rng.normal(size=(40, 3))
    b = a + rng.normal(scale=0.3, size=a.shape) if related else rng.normal(size=a.shape)
    geo = rng.uniform(size=(40, 2))
    return distances(a), distances(b), distances(geo)


def test_unrelated_spaces_are_not_called_agreement():
    # Without the permutation null p would be fixed or tiny; with it, unrelated spaces give large p.
    ps = [mantel(*matrices(seed, False), np.random.default_rng(seed), permutations=199)["partial_p"]
          for seed in range(5)]
    assert max(ps) > 0.2
    assert all(round(p * 200) == p * 200 for p in ps)  # p = (1 + count) / (1 + 199)


def test_related_spaces_reach_the_permutation_floor():
    result = mantel(*matrices(0, True), np.random.default_rng(0), permutations=199)
    assert result["r"] > 0.5 and result["partial_r"] > 0.5
    assert result["p"] == result["partial_p"] == 1 / 200


def test_nearest_excludes_self_and_breaks_ties_by_order():
    d = np.array([[0, 1, 1, 2], [1, 0, 3, 3], [1, 3, 0, 3], [2, 3, 3, 0]], dtype=float)
    assert nearest(d, 2).tolist() == [[1, 2], [0, 2], [0, 1], [0, 1]]
    assert jaccard(np.array([[1, 2]]), np.array([[2, 3]])).tolist() == [1 / 3]


def test_chance_jaccard_matches_simulation():
    rng = np.random.default_rng(1)
    sim = np.mean([len(set(x) & set(y)) / len(set(x) | set(y))
                   for x, y in ((rng.choice(99, 10, replace=False), rng.choice(99, 10, replace=False))
                                for _ in range(20_000))])
    assert abs(chance_jaccard(100) - sim) < 0.003


def test_holm():
    assert holm([0.01, 0.04, 0.03]) == [0.03, 0.06, 0.06]


def test_partial_r_removes_what_geography_explains():
    # Both spaces are noisy copies of geography: plain r is high, partial r is near zero.
    rng = np.random.default_rng(2)
    xy = rng.uniform(size=(40, 2))
    geo = distances(xy)
    a = distances(np.column_stack([xy, rng.normal(scale=0.05, size=(40, 1))]))
    b = distances(np.column_stack([xy, rng.normal(scale=0.05, size=(40, 1))]))
    result = mantel(a, b, geo, np.random.default_rng(2), permutations=99)
    assert result["r"] > 0.9
    assert abs(result["partial_r"]) < 0.3 < result["r"] - result["partial_r"]


def test_clr_rows_centre_and_ignore_scale():
    counts = np.array([[10.0, 20.0, 70.0], [100.0, 200.0, 700.0]])
    out = clr(counts)
    assert np.allclose(out.sum(axis=1), 0)
    assert np.allclose(out[0], clr(counts[:1] * 3)[0], atol=0.05)  # +0.5 pseudo-count only
    assert np.allclose(out[1], np.log([1, 2, 7]) - np.log([1, 2, 7]).mean(), atol=0.01)


def test_centroid_and_distance():
    square = [[0, 0], [2, 0], [2, 2], [0, 2]]
    assert centroid(square) == (1.0, 1.0)
    assert centroid(square[::-1] + [square[-1]]) == (1.0, 1.0)  # orientation and a closing vertex
    assert centroid([[0, 0], [3, 0], [0, 3]]) == (1.0, 1.0)
    assert ring_area(square) == 4.0
    d = distances(np.array([[0.0, 0.0], [3.0, 4.0]]))
    assert d.tolist() == [[0.0, 5.0], [5.0, 0.0]]
