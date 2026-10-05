"""The DrugComb tree and clusters on small hand-made screens: features come from training rows
only, and the exported tree keeps its rules, counts and synergy shares."""
import sys
from pathlib import Path

import pandas as pd
import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "publish"))

pytest.importorskip("sklearn")
from drugcomb_ml import export_tree, featurise, pair_key  # noqa: E402


def rows(data):
    return pd.DataFrame(data, columns=["Drug1", "Drug2", "Cell line", "ZIP", "lineage"])


def test_features_use_training_statistics_only():
    train = rows([("A", "B", "c1", 20, "Bone"), ("A", "C", "c1", 0, "Bone"), ("B", "C", "c2", -10, "Skin")])
    test = rows([("A", "D", "c3", 99, "Bone")])
    x = featurise(test, train, ["Bone"])
    # A's mean in training is 10; D and c3 are unseen and get the training mean (10/3).
    assert x["stronger_drug_zip"].iloc[0] == 10
    assert x["weaker_drug_zip"].iloc[0] == pytest.approx(10 / 3)
    assert x["cell_zip"].iloc[0] == pytest.approx(10 / 3)
    assert x["tissue=Bone"].iloc[0] == 1.0


def test_pair_key_ignores_order():
    a = pd.Series(["X", "Y"])
    b = pd.Series(["Y", "X"])
    assert list(pair_key(a, b)) == ["X|Y", "X|Y"]


def test_export_tree_keeps_rules_counts_and_shares():
    from sklearn.tree import DecisionTreeClassifier

    x = pd.DataFrame({"cell_zip": [0, 1, 2, 10, 11, 12]})
    y = [0, 0, 0, 1, 1, 1]
    tree = DecisionTreeClassifier(max_depth=1).fit(x, y)
    out = export_tree(tree, ["cell_zip"])
    assert out["n"] == 6 and out["share"] == 0.5
    assert out["rule"]["en"].startswith("Cell line's mean ZIP ≤ 6.00")
    left, right = out["children"]
    assert (left["n"], left["share"], right["share"]) == (3, 0.0, 1.0)
