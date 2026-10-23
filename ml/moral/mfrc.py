"""Part A, English: the MFRC foundation tagger, its human ceiling and the eMFD baseline.

    python -m ml.moral.mfrc fetch    # MFRC, eMFD and ETHICS into warehouse/raw/philosophy_moral
    python -m ml.moral.mfrc embed    # bge-m3 vectors of every MFRC comment (Workers AI, cached)
    python -m ml.moral.mfrc fit      # tagger.npz and agreement.parquet under FEATURES
    python -m ml.moral.mfrc ci       # adds 95 % bootstrap intervals to agreement.parquet (no refit)

Every choice (gold label, split, C grid, threshold grid, ceiling, eMFD scoring) is fixed in
docs/philosophy-moral-preregistration.md. No comment text is written outside RAW.
"""
from __future__ import annotations

import argparse
import json
import re
import sys

import numpy as np
import pandas as pd

from ml.moral import FEATURES, FOUNDATIONS, RAW, REPO, embed
from ml.moral.stats import SEED, alpha_binary, f1, rank

MFRC_REV = "ddc21d2f03e156732fd1ba95a51c4c29f07975be"
ETHICS_REV = "b8b47c589f8bee77175b8648e5497278b68da48a"
SOURCES = {
    "mfrc.parquet": f"https://huggingface.co/datasets/USC-MOLA-Lab/MFRC/resolve/{MFRC_REV}/data/train_dedup-00000-of-00001.parquet",
    "emfd_scoring.csv": "https://raw.githubusercontent.com/medianeuroscience/emfdscore/master/emfdscore/dictionaries/emfd_scoring.csv",
    **{f"ethics/{s}.csv": f"https://huggingface.co/datasets/hendrycks/ethics/resolve/{ETHICS_REV}/data/{s}/test.csv"
       for s in ("commonsense", "deontology", "justice", "utilitarianism", "virtue")},
}
C_GRID = (0.1, 1.0, 10.0)
THRESHOLDS = np.round(np.arange(0.05, 0.951, 0.05), 2)
WORD = re.compile(r"[a-z']+")
# eMFD's one fairness foundation is compared with equality or proportionality merged.
EMFD = {"care": "care_p", "fairness": "fairness_p", "loyalty": "loyalty_p", "authority": "authority_p",
        "purity": "sanctity_p"}


def fetch() -> None:
    sys.path.insert(0, str(REPO / "platform/lib"))
    import rawstore
    http = rawstore.session()
    for relative, url in SOURCES.items():
        print(rawstore.fetch(http, "philosophy_moral", relative, url))


def comments() -> tuple[pd.DataFrame, pd.DataFrame]:
    """(one row per comment with gold labels and split, one row per annotator and comment)."""
    rows = pd.read_parquet(RAW / "mfrc.parquet", columns=["text", "annotator", "annotation"])
    rows["comment_id"] = [rank("mfrc", t) for t in rows.text]
    for f in FOUNDATIONS:
        rows[f] = rows.annotation.str.lower().str.split(",").apply(lambda labels, f=f: f in [x.strip() for x in labels])
    # One row per annotator and comment; a duplicated annotator row counts once.
    rows = rows.groupby(["comment_id", "annotator"], as_index=False).agg(
        text=("text", "first"), **{f: (f, "max") for f in FOUNDATIONS})
    gold = rows.groupby("comment_id").agg(text=("text", "first"), annotators=("annotator", "size"),
                                          **{f: (f, "mean") for f in FOUNDATIONS}).reset_index()
    for f in FOUNDATIONS:
        gold[f] = gold[f] > 0.5
    gold["fairness"] = gold.equality | gold.proportionality
    rows["fairness"] = rows.equality | rows.proportionality
    gold["split"] = np.where([rank(t) % 5 == 0 for t in gold.text], "test", "train")
    return gold, rows


def best_threshold(truth, scores) -> tuple[float, float]:
    scored = [(f1(truth, scores >= t) or 0.0, t) for t in THRESHOLDS]
    return max(scored)[1], max(scored)[0]


def fit_one(x, y, folds):
    """C by mean out-of-fold F1, then the out-of-fold F1-best threshold; refit on all of x."""
    from sklearn.linear_model import LogisticRegression
    best = None
    for c in C_GRID:
        oof = np.zeros(len(y))
        for k in range(5):
            model = LogisticRegression(C=c, class_weight="balanced", max_iter=2000)
            model.fit(x[folds != k], y[folds != k])
            oof[folds == k] = model.predict_proba(x[folds == k])[:, 1]
        threshold, score = best_threshold(y, oof)
        if best is None or score > best[0]:
            best = (score, c, threshold)
    model = LogisticRegression(C=best[1], class_weight="balanced", max_iter=2000).fit(x, y)
    return model, best[1], best[2]


def ceiling(rows: pd.DataFrame, test_ids: set, label: str, predicted: dict | None = None) -> float | None:
    """Mean F1 of one annotator against another over ordered pairs on the same comments (>= 3 annotators);
    with `predicted`, the tagger's mean F1 against each single annotator on the same comments."""
    rows = rows[rows.comment_id.isin(test_ids)]
    rows = rows[rows.groupby("comment_id").annotator.transform("size") >= 3]
    wide = rows.pivot(index="comment_id", columns="annotator", values=label)
    scores = []
    for a in wide.columns:
        if predicted is not None:
            both = wide[a].notna()
            scores.append(f1(wide[a][both].astype(bool), [predicted[i] for i in wide.index[both]]))
            continue
        for b in wide.columns:
            both = wide[a].notna() & wide[b].notna()
            if a != b and both.sum():
                scores.append(f1(wide[b][both].astype(bool), wide[a][both].astype(bool)))
    scores = [s for s in scores if s is not None]
    return float(np.mean(scores)) if scores else None


def emfd_scores(texts: pd.Series) -> pd.DataFrame:
    words = pd.read_csv(RAW / "emfd_scoring.csv").set_index("word")
    table = words[list(EMFD.values())].to_dict("index")
    out = []
    for text in texts:
        hits = [table[w] for w in WORD.findall(text.lower()) if w in table]
        out.append({f: float(np.mean([h[c] for h in hits])) if hits else 0.0 for f, c in EMFD.items()})
    return pd.DataFrame(out, index=texts.index)


def fit() -> None:
    gold, rows = comments()
    vectors = np.load(FEATURES / "vectors/mfrc/vectors.npy")
    ids = json.loads((FEATURES / "vectors/mfrc/ids.json").read_text(encoding="utf-8"))
    position = {int(i): n for n, i in enumerate(ids)}
    x = vectors[[position[i] for i in gold.comment_id]]
    train, test = (gold.split == "train").to_numpy(), (gold.split == "test").to_numpy()
    folds = np.array([rank("fold", i) % 5 for i in gold.comment_id])[train]
    emfd = emfd_scores(gold.text)
    test_ids = set(gold.comment_id[test])
    labels, coefs, intercepts, thresholds, results = [], [], [], [], []
    for label in [*FOUNDATIONS, "fairness"]:
        y = gold[label].to_numpy()
        model, c, threshold = fit_one(x[train], y[train], folds)
        predicted = model.predict_proba(x[test])[:, 1] >= threshold
        row = {"foundation": label, "c": c, "threshold": threshold, "train_positives": int(y[train].sum()),
               "test_comments": int(test.sum()), "test_positives": int(y[test].sum()),
               "tagger_f1": f1(y[test], predicted),
               "tagger_vs_annotator_f1": ceiling(rows, test_ids, label, dict(zip(gold.comment_id[test], predicted))),
               "human_pair_f1": ceiling(rows, test_ids, label),
               "human_alpha": alpha_binary(rows[rows.comment_id.isin(test_ids)].groupby("comment_id")[label]
                                           .apply(lambda s: s.astype(int).tolist()).tolist())}
        if label in EMFD:
            t, _ = best_threshold(y[train], emfd[label].to_numpy()[train])
            row |= {"emfd_threshold": t, "emfd_f1": f1(y[test], emfd[label].to_numpy()[test] >= t)}
        results.append(row)
        labels.append(label)
        coefs.append(model.coef_[0])
        intercepts.append(model.intercept_[0])
        thresholds.append(threshold)
        print(json.dumps(row), flush=True)
    FEATURES.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(results).to_parquet(FEATURES / "agreement.parquet", index=False)
    np.savez(FEATURES / "tagger.npz", labels=np.array(labels), coef=np.stack(coefs),
             intercept=np.array(intercepts), threshold=np.array(thresholds))


def weighted_f1(truth, pred, w) -> float:
    tp, fp, fn = (w * (truth & pred)).sum(), (w * (~truth & pred)).sum(), (w * (truth & ~pred)).sum()
    return np.nan if 2 * tp + fp + fn == 0 else 2 * tp / (2 * tp + fp + fn)


def ceiling_gap(wide: np.ndarray, predicted: np.ndarray, w: np.ndarray) -> float:
    """`ceiling` with the tagger minus `ceiling` without it, on comments weighted by w (bootstrap counts)."""
    has, yes = ~np.isnan(wide), wide == 1
    tagger = [weighted_f1(yes[has[:, a], a], predicted[has[:, a]], w[has[:, a]]) for a in range(wide.shape[1])]
    humans = [weighted_f1(yes[both, b], yes[both, a], w[both])
              for a in range(wide.shape[1]) for b in range(wide.shape[1])
              if a != b and (both := has[:, a] & has[:, b]).any()]
    return float(np.nanmean(tagger) - np.nanmean(humans))


def intervals(rounds: int = 1000) -> None:
    """95 % intervals over resampled test comments for the tagger's F1 and for its gap to the human
    ceiling (tagger vs one annotator minus annotator vs annotator). Uses the stored tagger, no refit."""
    gold, rows = comments()
    vectors = np.load(FEATURES / "vectors/mfrc/vectors.npy")
    position = {int(i): n for n, i in enumerate(json.loads((FEATURES / "vectors/mfrc/ids.json").read_text(encoding="utf-8")))}
    test = gold[gold.split == "test"]
    x = vectors[[position[i] for i in test.comment_id]]
    tagger = np.load(FEATURES / "tagger.npz")
    agreement = pd.read_parquet(FEATURES / "agreement.parquet")
    rows = rows[rows.comment_id.isin(set(test.comment_id))]
    rows = rows[rows.groupby("comment_id").annotator.transform("size") >= 3]
    rng = np.random.default_rng(SEED)
    counts = [np.bincount(rng.integers(0, len(test), len(test)), minlength=len(test)) for _ in range(rounds)]
    out = {}
    for n, label in enumerate(tagger["labels"]):
        predicted = 1 / (1 + np.exp(-(x @ tagger["coef"][n] + tagger["intercept"][n]))) >= tagger["threshold"][n]
        y = test[label].to_numpy()
        wide = rows.pivot(index="comment_id", columns="annotator", values=label).astype(float)
        on = test.comment_id.isin(set(wide.index)).to_numpy()
        wide = wide.reindex(test.comment_id[on]).to_numpy()
        f1s = [weighted_f1(y, predicted, w) for w in counts]
        gaps = [ceiling_gap(wide, predicted[on], w[on]) for w in counts]
        out[str(label)] = [*np.nanpercentile(f1s, [2.5, 97.5]), *np.nanpercentile(gaps, [2.5, 97.5]),
                           ceiling_gap(wide, predicted[on], np.ones(on.sum()))]
        print(label, np.round(out[str(label)], 3), flush=True)
    for k, column in enumerate(["tagger_f1_low", "tagger_f1_high", "ceiling_gap_low", "ceiling_gap_high", "ceiling_gap"]):
        agreement[column] = agreement.foundation.map(lambda f: out[f][k])
    agreement.to_parquet(FEATURES / "agreement.parquet", index=False)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("step", choices=["fetch", "embed", "fit", "ci"])
    step = parser.parse_args().step
    if step == "fetch":
        fetch()
    elif step == "embed":
        gold, _ = comments()
        done = embed([str(i) for i in gold.comment_id], gold.text.tolist(), "mfrc", "moral-mfrc")
        sys.exit(0 if done is not None else 3)
    elif step == "fit":
        fit()
    else:
        intervals()


if __name__ == "__main__":
    main()
