"""Riksdag eras (clustering plan item 4): sessions grouped by topic mix, only neighbours merge.

    python platform/publish/clusters/eras.py

Session x topic word shares over all parties from gold fact_topic_session_party, one topic model
(parliament-current, checked to span all 33 sessions), unassigned speech left out. Ward
agglomeration with a chain connectivity, so an era is a run of consecutive sessions. The cut is
the largest jump in merge cost (ratio to the merge before it) among 2-8 eras; a pick at an end
of the sweep or near a tie is flagged (stats.k_flags).
- null: the sessions' order shuffled and refitted; the within-era sum of squares at the same k
  against the observed (an era structure tied to time leaves less within-era variation).
- bootstrap: topics drawn with replacement, refitted; ARI with the reference eras.
- AMI with the governments (parliament/sessions.json) and the breaks of SWEDEN E (2002, 2008, 2017).
"""
from __future__ import annotations

import json

import numpy as np
import pandas as pd
from scipy.sparse import diags
from sklearn.cluster import AgglomerativeClustering
from sklearn.metrics import adjusted_rand_score

import stats

TOPICS = stats.PUBLIC / "gold/tables/fact_topic_session_party.json"
SESSIONS = stats.PUBLIC / "parliament/sessions.json"
MODEL = "parliament-current"
FUTURES_BREAKS = [2002, 2008, 2017]
ROUNDS = 999


def chain(n: int):
    return diags([np.ones(n - 1), np.ones(n - 1)], [-1, 1])


def eras(x: np.ndarray, k: int) -> np.ndarray:
    return AgglomerativeClustering(k, linkage="ward", connectivity=chain(len(x))).fit_predict(x)


def within(x: np.ndarray, labels: np.ndarray) -> float:
    return float(sum(((x[labels == c] - x[labels == c].mean(axis=0)) ** 2).sum() for c in set(labels)))


def choose_cut(x: np.ndarray, ks=stats.KS) -> tuple[int, dict]:
    """Merge cost of going from k to k-1 eras; the cut is the k whose next merge costs most
    relative to the merge before it (the largest jump). Returns the k, the merge costs and the
    jump per k (the sweep for stats.k_flags)."""
    cost = {k: within(x, eras(x, k - 1)) - within(x, eras(x, k)) for k in range(ks[0], ks[-1] + 2)}
    jump = {k: round(cost[k] / cost[k + 1], 4) for k in ks}
    return max(jump, key=jump.get), {k: round(v, 5) for k, v in cost.items()}, jump


def order_null(x: np.ndarray, k: int, rounds: int = ROUNDS, seed: int = stats.SEED) -> dict:
    observed = within(x, eras(x, k))
    rng = np.random.default_rng(seed)
    null = np.array([within(d, eras(d, k)) for d in (x[rng.permutation(len(x))] for _ in range(rounds))])
    return {"statistic": "within-era sum of squares", "kind": "session order shuffled", "observed": round(observed, 5),
            "null_median": round(float(np.median(null)), 5), "null_05": round(float(np.percentile(null, 5)), 5),
            "p": round((1 + int((null <= observed).sum())) / (1 + rounds), 4), "rounds": rounds, "seed": seed}


def main() -> None:
    topics = pd.DataFrame(json.loads(TOPICS.read_text(encoding="utf-8")))
    topics = topics[(topics.model_id == MODEL) & (topics.topic_id >= 0)]
    matrix = topics.pivot_table(index="session", columns="topic_id", values="words", aggfunc="sum", fill_value=0)
    matrix = matrix.sort_index(key=lambda s: s.str[:4].astype(int))
    shares = matrix.div(matrix.sum(axis=1), axis=0)
    x = shares.to_numpy()
    k, cost, jump = choose_cut(x)
    labels = eras(x, k)
    rng = np.random.default_rng(stats.SEED)
    boot = [adjusted_rand_score(labels, eras(x[:, rng.integers(0, x.shape[1], x.shape[1])], k))
            for _ in range(100)]
    governments = {s["session"]: s["government_key"] for s in json.loads(SESSIONS.read_text(encoding="utf-8"))["sessions"]}
    years = shares.index.str[:4].astype(int)
    breaks = [int(years[i]) for i in range(1, len(labels)) if labels[i] != labels[i - 1]]
    futures = [sum(y >= b for b in FUTURES_BREAKS) for y in years]
    labels_text = topics.drop_duplicates("topic_id").set_index("topic_id").topic_label
    national = x.mean(axis=0)
    clusters = []
    for c in sorted(set(labels), key=lambda c: years[labels == c].min()):
        mean = x[labels == c].mean(axis=0)
        lift = np.argsort(-(mean - national))[:5]
        clusters.append({"id": int(c), "sessions": shares.index[labels == c].tolist(), "size": int((labels == c).sum()),
                         "top_topics": [[int(shares.columns[i]), labels_text[shares.columns[i]], round(float(mean[i]), 4),
                                         round(float(mean[i] - national[i]), 4)] for i in lift]})
    diagnostics = stats.diagnostics(
        labels, stats.silhouette(x, labels),
        stats.summary(boot, 100, stats.SEED, "topics drawn with replacement, refitted at the same k"),
        order_null(x, k),
        {"government": stats.ami(labels, [governments.get(s) for s in shares.index]),
         "futures_breaks": stats.ami(labels, futures)},
        space="topic word shares per session", sweep=jump, note="33 sessions: descriptive.")
    metrics = {"title": "Riksdag eras", "method": {"features": f"word shares over {x.shape[1]} {MODEL} topics",
                                                   "algorithm": "Ward with chain connectivity", "k": k,
                                                   "merge_cost": cost, "merge_cost_jump": jump},
               "diagnostics": diagnostics, "clusters": clusters, "breaks": breaks, "futures_breaks": FUTURES_BREAKS,
               "topic_shares": {"sessions": shares.index.tolist(), "topics": [[int(t), labels_text[t]] for t in shares.columns],
                          "rows": np.round(x, 4).tolist()},
               "assignments": ["riksdag-eras"], "members": True, "shares": False}
    assignments = stats.frame("riksdag-eras", shares.index, shares.index, "1993-2026", labels)
    stats.save("riksdag-eras", shares.reset_index().rename(columns=str), assignments, metrics)


if __name__ == "__main__":
    main()
