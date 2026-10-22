"""SWEDEN E topic pilot: describe the clusters for review and run the pre-registered analyses.

    python -m ml.futures_topics.analyze

Reads RUN/sample.parquet, the embedding shards and the cluster run, writes under
<PORTFOLIO_FEATURES>/sweden/futures_topics/ (no sentence text):

    topics.parquet     sentence id, corpus, year, cluster, probability, model, revision, run_id
    clusters.parquet   cluster × corpus: top terms, stability, trend and Riksdag-DiVA statistics
    cells.parquet      cluster × corpus × year: sentences and a 95 % bootstrap interval of the share

and the owner's review sheet tmp/topics-review.csv (terms and example sentences, never published).
Every label is "unreviewed cluster N" until the owner has reviewed it.
"""
from __future__ import annotations

import csv
import hashlib
import json
import re
import sys

import numpy as np
import pandas as pd

from ml.futures_topics.cluster import centre, embeddings, sample_key
from ml.futures_topics.sentences import FEATURES, REPO, RUN, SEED, YEARS

sys.path.insert(0, str(REPO / "platform/nlp/symbolic"))
sys.path.insert(0, str(REPO / "platform/publish"))
from diva_clusters import STOP  # noqa: E402
from rank_clusters import ctfidf  # noqa: E402

ROUNDS = 999
BOOT = 1000
LAGS = range(-3, 4)
OVERLAP = (2005, 2025)
STOPS = sorted(STOP | set("herr fru talman ledamot ledamoten jag vi våra vår vårt oss ni er man skall måste "
                          "kommer också så att inte bara nu här där".split()))
# Exploratory only: which clusters to list in the securitisation reading, never a name.
SECURITY = re.compile(r"\b(?:säkerhet\w*|försvar\w*|hot|hotet|hoten|hotbild\w*|kris|krisen|kriser\w*|krisberedskap"
                      r"|krig\w*|beredskap\w*|terror\w*|militär\w*|nato|ryssland)\b", re.I)
PAIR_COLUMNS = ["cluster", "r_lag0", "p_lag0", "best_lag", "r_best_lag", "p_best_lag", "r_by_lag"]
# Departures from docs/sweden-futures-topics-preregistration.md ("Changes after registration").
DEVIATIONS = [
    {"date": "2026-10-22", "change": "storage",
     "reason": "The first UMAP fit ran out of memory on the laptop, so the clustering runs in "
               ".github/workflows/cluster-jobs.yml and the sample and embedding shards are kept in "
               "the R2 warehouse store under features/sweden/futures_topics/run/, never in a release."},
    {"date": "2026-10-22", "change": "compute",
     "reason": "The method is unchanged: UMAP on the full centred vectors with the registered grid on a "
               "16 GB runner, TensorFlow kept out of the process, and the centred space rebuilt from "
               "the shards for the analysis instead of being saved twice."},
]


def holm(p: list[float]) -> list[float]:
    order = np.argsort(p)
    out, running = np.empty(len(p)), 0.0
    for i, j in enumerate(order):
        running = max(running, min(1.0, (len(p) - i) * p[j]))
        out[j] = running
    return out.tolist()


def slope(x: np.ndarray, y: np.ndarray) -> float:
    return float(np.polyfit(x, y, 1)[0])


def trend(years: np.ndarray, share: np.ndarray, rng) -> tuple[float, float]:
    observed = slope(years, share)
    null = np.array([slope(years, rng.permutation(share)) for _ in range(ROUNDS)])
    return observed, float((1 + (np.abs(null) >= abs(observed)).sum()) / (ROUNDS + 1))


def lagged(a: np.ndarray, b: np.ndarray, lag: int) -> float:
    """Correlation of a[t] with b[t + lag]; positive lag: DiVA follows the Riksdag."""
    x, y = (a[:len(a) - lag], b[lag:]) if lag >= 0 else (a[-lag:], b[:len(b) + lag])
    return float(np.corrcoef(x, y)[0, 1]) if len(x) > 2 and x.std() and y.std() else 0.0


def cross(riksdag: np.ndarray, diva: np.ndarray, rng) -> dict:
    a, b = np.diff(riksdag), np.diff(diva)
    r0 = lagged(a, b, 0)
    rs = {lag: lagged(a, b, lag) for lag in LAGS}
    best = max(rs, key=lambda k: abs(rs[k]))
    null0, nullmax = [], []
    for _ in range(ROUNDS):
        p = rng.permutation(b)
        null0.append(abs(lagged(a, p, 0)))
        nullmax.append(max(abs(lagged(a, p, lag)) for lag in LAGS))
    return {"r_lag0": r0, "p_lag0": float((1 + (np.array(null0) >= abs(r0)).sum()) / (ROUNDS + 1)),
            "best_lag": best, "r_best_lag": rs[best],
            "p_best_lag": float((1 + (np.array(nullmax) >= abs(rs[best])).sum()) / (ROUNDS + 1)),
            "r_by_lag": json.dumps({str(k): round(v, 4) for k, v in rs.items()})}


def pairs_table(pairs: list[dict]) -> pd.DataFrame:
    """The Riksdag-DiVA tests with Holm columns, also when no cluster qualified."""
    table = pd.DataFrame(pairs, columns=PAIR_COLUMNS)
    table["p_lag0_holm"] = holm(table.p_lag0.tolist())
    table["p_best_lag_holm"] = holm(table.p_best_lag.tolist())
    return table


def main() -> None:
    sample = pd.read_parquet(RUN / "sample.parquet")
    frame = sample.merge(pd.read_parquet(RUN / "labels.parquet"), on="sentence_id", validate="one_to_one")
    metrics = json.loads((RUN / "metrics.json").read_text(encoding="utf-8"))
    if metrics.get("sample_key") != sample_key(sample):
        raise SystemExit("metrics.json belongs to another sample; rerun ml.futures_topics.cluster")
    # The corpus-centred space, rebuilt from the stored shards rather than kept as a second copy.
    space = centre(embeddings(sample), sample.corpus.to_numpy())
    run_id = "futures-topics-" + hashlib.sha1(frame.cluster.to_numpy().tobytes()).hexdigest()[:10]
    rng = np.random.default_rng(SEED)
    clusters = sorted(c for c in frame.cluster.unique() if c >= 0)
    jaccard = {int(k): v for k, v in metrics["stability"]["cluster_jaccard_min_over_seeds"].items()}
    passes = metrics["stability"]["passes"] and metrics["null_shuffled_dimensions"]["passes"]
    stable = {c: passes and jaccard.get(c, 0.0) >= 0.5 for c in clusters}
    # The marker words are in every sentence by construction; they would top every cluster.
    marker = re.compile(r"\b(?:framtid\w*|långsiktig\w*|vision\w*|morgondagens|kommande|generationer|sikt)\b", re.I)
    terms = ctfidf({c: [marker.sub(" ", t) for t in frame.sentence[frame.cluster == c]] for c in clusters},
                   top=10, stop_words_override=STOPS, token_pattern=r"(?u)\b[^\W\d_][^\W\d_]{2,}\b")
    top = {c: [t["term"] for t in terms if t["cluster_id"] == c] for c in clusters}

    cells, rows, review = [], [], []
    totals = frame.groupby(["corpus", "year"]).size()
    counts = frame.groupby(["corpus", "year", "cluster"]).size()
    for (corpus, year), n in totals.items():
        shares = np.array([counts.get((corpus, year, c), 0) for c in [-1, *clusters]]) / n
        boot = rng.multinomial(n, shares, size=BOOT) / n
        low, high = np.percentile(boot, [2.5, 97.5], axis=0)
        for i, c in enumerate([-1, *clusters]):
            cells.append({"corpus": corpus, "year": int(year), "cluster": int(c), "sentences": int(shares[i] * n + 0.5),
                          "year_sentences": int(n), "share": float(shares[i]),
                          "share_low": float(low[i]), "share_high": float(high[i])})
    cells = pd.DataFrame(cells)

    def series(corpus, c, first, last):
        """Every year of first..last in order; a year without sampled sentences is NaN."""
        part = cells[(cells.corpus == corpus) & (cells.cluster == c)].set_index("year").share
        share = part.reindex(range(first, last + 1)).to_numpy()
        return np.arange(first, last + 1), share

    for c in clusters:
        members = np.flatnonzero(frame.cluster.to_numpy() == c)
        centroid = space[members].mean(axis=0)
        closest = members[np.argsort(-(space[members] @ centroid))[:5]]
        for corpus in ("riksdag", "diva"):
            years, share = series(corpus, c, *YEARS[corpus])
            years, share = years[~np.isnan(share)], share[~np.isnan(share)]
            s, p = trend(years, share, rng)
            rows.append({"cluster": int(c), "corpus": corpus, "label": f"unreviewed cluster {c}",
                         "top_terms": ", ".join(top[c]), "sentences": int((frame.cluster == c).sum()),
                         "corpus_sentences": int(((frame.cluster == c) & (frame.corpus == corpus)).sum()),
                         "stable": bool(stable[c]), "jaccard_min": float(jaccard.get(c, 0.0)),
                         "security_terms": bool(SECURITY.search(" ".join(top[c]))),
                         "trend_slope": s, "trend_p": p, "share_mean": float(share.mean())})
        corpus_share = frame.corpus[members].value_counts(normalize=True)
        for row in rows[-2:]:
            row["corpus_specific"] = bool(corpus_share.max() >= 0.9)
        review.append({"cluster": c, "sentences": len(members),
                       "riksdag_share": round(float(corpus_share.get("riksdag", 0)), 3),
                       "stable": stable[c], "top_terms": ", ".join(top[c]),
                       **{f"example_{i + 1}": f"[{frame.corpus[j]} {frame.year[j]}] {frame.sentence[j]}"
                          for i, j in enumerate(closest)},
                       "suggested_label": f"unreviewed cluster {c}", "decision": "keep/merge/drop"})
    table = pd.DataFrame(rows)
    tested = table.stable
    table["trend_p_holm"] = np.nan
    table.loc[tested, "trend_p_holm"] = holm(table.trend_p[tested].tolist()) if tested.any() else []
    pairs = []
    corpus_total = frame.corpus.value_counts()
    for c in clusters:
        part = table[table.cluster == c].set_index("corpus").corpus_sentences
        riksdag, diva = series("riksdag", c, *OVERLAP)[1], series("diva", c, *OVERLAP)[1]
        # At least 1 % of each corpus's sampled sentences, and every overlap year present in both.
        if (stable[c] and (part / corpus_total[part.index]).min() >= 0.01
                and not np.isnan(riksdag).any() and not np.isnan(diva).any()):
            pairs.append({"cluster": c, **cross(riksdag, diva, rng)})
    table = table.merge(pairs_table(pairs), on="cluster", how="left")
    meta = {"model": metrics["model"], "revision": metrics["revision"], "run_id": run_id}
    FEATURES.mkdir(parents=True, exist_ok=True)
    frame[["sentence_id", "corpus", "year", "cluster", "probability"]].assign(**meta).to_parquet(
        FEATURES / "topics.parquet", index=False)
    table.assign(**meta).to_parquet(FEATURES / "clusters.parquet", index=False)
    cells.assign(run_id=run_id).to_parquet(FEATURES / "cells.parquet", index=False)
    (FEATURES / "method.json").write_text(json.dumps({**meta, **{k: metrics[k] for k in (
        "sentences", "space", "selected", "stability", "null_shuffled_dimensions", "corpus_ami")},
        "baseline": metrics["baseline"], "preregistration": "docs/sweden-futures-topics-preregistration.md",
        "deviations": DEVIATIONS}, indent=2, default=float) + "\n", encoding="utf-8")
    sheet = REPO / "tmp/topics-review.csv"
    sheet.parent.mkdir(exist_ok=True)
    with sheet.open("w", newline="", encoding="utf-8") as out:
        writer = csv.DictWriter(out, fieldnames=list(review[0]))
        writer.writeheader()
        writer.writerows(review)
    pd.set_option("display.width", 220)
    print(table[["cluster", "corpus", "corpus_sentences", "stable", "trend_slope", "trend_p_holm", "r_lag0",
                 "p_lag0_holm", "best_lag", "p_best_lag_holm", "top_terms"]].to_string(max_colwidth=60))


if __name__ == "__main__":
    main()
