"""Two small models on the real DrugCombDB screens, for the DrugComb page: a decision tree that
shows how a tree decides whether a drug pair is synergistic, and drugs clustered by where they
are synergistic.

- Data (|ZIP| > 100 dropped as impossible): drugcombs_scored.csv (DrugCombDB) and DepMap's Model.csv for each cell line's tissue, the
  same files and checksums as products/drugcomb/data_manifest.json. Downloaded to
  warehouse/drugcomb/ (never committed).
- Tree: label is ZIP > 10. The pairs are split 80/20 by drug pair, so the test pairs are pairs the
  tree has never seen. Features are computed on the training pairs only: each drug's mean ZIP (the
  stronger and weaker drug of the pair), the cell line's mean ZIP, and its tissue. Depth 4, at
  least 2,000 measurements per leaf, so every rule can be read.
- Clusters: drugs tested in at least 300 measurements, described by their mean ZIP in each tissue;
  standardised, k-means for k = 3…8, the k with the best silhouette kept, placed on a plane by PCA.

Writes frontend/public/data/products/drugcomb/tree.json and drug-clusters.json.

    python platform/publish/drugcomb_ml.py
"""
from __future__ import annotations

import hashlib
import json
import re
import sys
import urllib.request
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / "warehouse/drugcomb"
OUT = ROOT / "frontend/public/data/products/drugcomb"
MANIFEST = OUT / "data_manifest.json"
FILES = {"drugcombs_scored.csv": "drugcombdb", "Model.csv": "depmap"}
SYNERGY = 10.0
MAX_ZIP = 100.0
SEED = 0

FEATURES = {
    "stronger_drug_zip": ("Stronger drug's mean ZIP", "Starkare läkemedlets medel-ZIP"),
    "weaker_drug_zip": ("Weaker drug's mean ZIP", "Svagare läkemedlets medel-ZIP"),
    "cell_zip": ("Cell line's mean ZIP", "Cellinjens medel-ZIP"),
}


def fetch() -> dict[str, Path]:
    """The two source files, downloaded once and checked against the project's manifest."""
    manifest = {m["file"]: m for m in json.loads(MANIFEST.read_text(encoding="utf-8"))}
    CACHE.mkdir(parents=True, exist_ok=True)
    paths = {}
    for name in FILES:
        path = CACHE / name
        if not path.exists():
            print(f"Downloading {name}")
            urllib.request.urlretrieve(manifest[name]["url"], path)
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        if digest != manifest[name]["sha256"]:
            raise SystemExit(f"{name}: checksum {digest} does not match the manifest")
        paths[name] = path
    return paths


def norm(name: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", str(name).upper())


def lineages(model: pd.DataFrame) -> dict[str, str]:
    """Cell line name (normalised) → DepMap tissue lineage."""
    out = {}
    for col in ("CellLineName", "StrippedCellLineName"):
        out.update({norm(n): lin for n, lin in zip(model[col], model["OncotreeLineage"]) if isinstance(lin, str)})
    return out


def pair_key(a: pd.Series, b: pd.Series) -> pd.Series:
    return np.where(a < b, a + "|" + b, b + "|" + a)


def drug_means(train: pd.DataFrame) -> pd.Series:
    both = pd.concat([train[["Drug1", "ZIP"]].rename(columns={"Drug1": "drug"}),
                      train[["Drug2", "ZIP"]].rename(columns={"Drug2": "drug"})])
    return both.groupby("drug")["ZIP"].mean()


def featurise(rows: pd.DataFrame, train: pd.DataFrame, tissues: list[str]) -> pd.DataFrame:
    """Features for rows from statistics of the training rows only; unseen drugs or cell lines get
    the training mean."""
    overall = train["ZIP"].mean()
    drug = drug_means(train)
    cell = train.groupby("Cell line")["ZIP"].mean()
    d1 = rows["Drug1"].map(drug).fillna(overall)
    d2 = rows["Drug2"].map(drug).fillna(overall)
    x = pd.DataFrame({
        "stronger_drug_zip": np.maximum(d1, d2),
        "weaker_drug_zip": np.minimum(d1, d2),
        "cell_zip": rows["Cell line"].map(cell).fillna(overall),
    }, index=rows.index)
    for t in tissues:
        x[f"tissue={t}"] = (rows["lineage"] == t).astype(float)
    return x


def feature_label(name: str) -> tuple[str, str]:
    if name.startswith("tissue="):
        t = name.split("=", 1)[1]
        return (f"Tissue is {t}", f"Vävnaden är {t}")
    return FEATURES[name]


def export_tree(tree, columns: list[str]) -> dict:
    """The fitted tree as nested nodes: the rule, how many measurements reach it and what share
    of them were synergistic. The left child is where the rule holds."""
    t = tree.tree_

    def node(i: int, depth: int) -> dict:
        n = int(t.n_node_samples[i])
        value = t.value[i][0]
        share = float(value[1] / value.sum()) if value.sum() else 0.0
        out = {"id": int(i), "depth": depth, "n": n, "share": round(share, 4)}
        if t.children_left[i] == -1:
            return out
        name = columns[t.feature[i]]
        en, sv = feature_label(name)
        thr = float(t.threshold[i])
        if name.startswith("tissue="):
            rule = {"en": f"{en}?", "sv": f"{sv}?", "yes": {"en": "no", "sv": "nej"}, "no": {"en": "yes", "sv": "ja"}}
        else:
            rule = {"en": f"{en} ≤ {thr:.2f}?", "sv": f"{sv} ≤ {thr:.2f}?", "yes": {"en": "yes", "sv": "ja"}, "no": {"en": "no", "sv": "nej"}}
        out.update({"feature": name, "threshold": round(thr, 3), "rule": rule,
                    "children": [node(t.children_left[i], depth + 1), node(t.children_right[i], depth + 1)]})
        return out

    return node(0, 0)


def train_tree(data: pd.DataFrame) -> dict:
    from sklearn.metrics import average_precision_score, roc_auc_score
    from sklearn.model_selection import GroupShuffleSplit
    from sklearn.tree import DecisionTreeClassifier

    groups = pair_key(data["Drug1"], data["Drug2"])
    train_idx, test_idx = next(GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=SEED).split(data, groups=groups))
    train, test = data.iloc[train_idx], data.iloc[test_idx]
    tissues = [t for t, n in train["lineage"].value_counts().items() if n >= 5000 and t != "Unknown"]
    x_train, x_test = featurise(train, train, tissues), featurise(test, train, tissues)
    y_train, y_test = (train["ZIP"] > SYNERGY).astype(int), (test["ZIP"] > SYNERGY).astype(int)
    tree = DecisionTreeClassifier(max_depth=4, min_samples_leaf=2000, random_state=SEED).fit(x_train, y_train)
    p = tree.predict_proba(x_test)[:, 1]
    return {
        "tree": export_tree(tree, list(x_train.columns)),
        "metrics": {
            "train_measurements": int(len(train)),
            "test_measurements": int(len(test)),
            "test_pairs": int(pd.Series(groups[test_idx]).nunique()),
            "base_rate": round(float(y_test.mean()), 4),
            "roc_auc": round(float(roc_auc_score(y_test, p)), 3),
            "average_precision": round(float(average_precision_score(y_test, p)), 3),
            "leaves": int(tree.get_n_leaves()),
            "depth": int(tree.get_depth()),
        },
        "importance": sorted(
            [{"feature": c, "label": dict(zip(("en", "sv"), feature_label(c))), "gain": round(float(g), 4)}
             for c, g in zip(x_train.columns, tree.feature_importances_) if g > 0],
            key=lambda f: -f["gain"],
        ),
    }


def cluster_drugs(data: pd.DataFrame, min_rows: int = 300) -> dict:
    """Drugs described by their mean ZIP per tissue, clustered with k-means; k by silhouette."""
    from sklearn.cluster import KMeans
    from sklearn.decomposition import PCA
    from sklearn.metrics import silhouette_score
    from sklearn.preprocessing import StandardScaler

    long = pd.concat([data[["Drug1", "lineage", "ZIP"]].rename(columns={"Drug1": "drug"}),
                      data[["Drug2", "lineage", "ZIP"]].rename(columns={"Drug2": "drug"})])
    counts = long["drug"].value_counts()
    keep = counts[counts >= min_rows].index
    long = long[long["drug"].isin(keep)]
    tissues = [t for t, n in long["lineage"].value_counts().items() if n >= 2000]
    profile = long[long["lineage"].isin(tissues)].pivot_table(index="drug", columns="lineage", values="ZIP", aggfunc="mean")
    overall = long.groupby("drug")["ZIP"].mean()
    profile = profile.apply(lambda col: col.fillna(overall))
    z = StandardScaler().fit_transform(profile.values)
    scores = {}
    fits = {}
    for k in range(3, 9):
        km = KMeans(n_clusters=k, n_init=10, random_state=SEED).fit(z)
        scores[k] = float(silhouette_score(z, km.labels_))
        fits[k] = km
    best = max(scores, key=scores.get)
    labels = fits[best].labels_
    xy = PCA(n_components=2, random_state=SEED).fit_transform(z)
    share = long.assign(syn=long["ZIP"] > SYNERGY).groupby("drug")["syn"].mean()
    drugs = [
        {"drug": d, "cluster": int(c), "x": round(float(p[0]), 3), "y": round(float(p[1]), 3),
         "n": int(counts[d]), "mean_zip": round(float(overall[d]), 2), "share": round(float(share[d]), 4)}
        for d, c, p in zip(profile.index, labels, xy)
    ]
    clusters = []
    for c in range(best):
        members = profile[labels == c]
        means = members.mean().sort_values(ascending=False)
        clusters.append({
            "id": c,
            "size": int(len(members)),
            "mean_zip": round(float(overall[members.index].mean()), 2),
            "highest": [{"tissue": t, "zip": round(float(v), 2)} for t, v in means.head(3).items()],
            "lowest": [{"tissue": t, "zip": round(float(v), 2)} for t, v in means.tail(2).items()],
            "examples": [d for d in counts[members.index].sort_values(ascending=False).index[:5]],
        })
    return {
        "k": best,
        "silhouette": {str(k): round(v, 3) for k, v in scores.items()},
        "tissues": tissues,
        "drugs": drugs,
        "clusters": clusters,
    }


def main() -> int:
    paths = fetch()
    data = pd.read_csv(paths["drugcombs_scored.csv"], usecols=["Drug1", "Drug2", "Cell line", "ZIP"]).dropna()
    data["Drug1"] = data["Drug1"].astype(str)
    data["Drug2"] = data["Drug2"].astype(str)
    # ZIP is a difference in percentage points; |ZIP| > 100 cannot be a real response (the file has
    # values up to 1.8 million), so those measurements are dropped and counted.
    invalid = int((data["ZIP"].abs() > MAX_ZIP).sum())
    data = data[data["ZIP"].abs() <= MAX_ZIP]
    look = lineages(pd.read_csv(paths["Model.csv"], usecols=["CellLineName", "StrippedCellLineName", "OncotreeLineage"]))
    data["lineage"] = data["Cell line"].map(lambda c: look.get(norm(c), "Unknown"))
    matched = float((data["lineage"] != "Unknown").mean())

    method = {
        "source": "DrugCombDB drugcombs_scored.csv and DepMap 24Q4 Model.csv, checked against data_manifest.json",
        "measurements": int(len(data)),
        "dropped_invalid_zip": invalid,
        "tissue_matched_share": round(matched, 4),
        "synergy": f"ZIP > {SYNERGY:g}",
    }
    tree = train_tree(data)
    tree["method"] = {**method, "split": "80/20 by drug pair (test pairs never seen in training); features from training pairs only",
                      "model": "scikit-learn DecisionTreeClassifier, depth 4, at least 2,000 measurements per leaf"}
    clusters = cluster_drugs(data)
    clusters["method"] = {**method, "model": "Drugs with ≥ 300 measurements; mean ZIP per tissue, standardised; k-means, k = 3…8 by silhouette; PCA for the map"}
    for name, obj in (("tree.json", tree), ("drug-clusters.json", clusters)):
        (OUT / name).write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    m = tree["metrics"]
    print(f"tree: AUC {m['roc_auc']}, AP {m['average_precision']} (base {m['base_rate']}), {m['leaves']} leaves")
    print(f"clusters: k={clusters['k']}, {len(clusters['drugs'])} drugs, silhouette {clusters['silhouette']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
