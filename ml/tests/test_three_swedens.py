"""The three-spaces statistics: the permutation null, neighbours, chance Jaccard and Holm."""
import numpy as np

from ml.three_swedens import chance_jaccard, distances, holm, jaccard, mantel, nearest


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
