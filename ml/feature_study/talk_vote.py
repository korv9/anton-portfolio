"""Party groups per Riksdag session: topic talk, votes and both, with the same checks.

    python -m ml.feature_study.talk_vote

Inputs as platform/publish/clusters/talk_vote.py (fact_topic_session_party for the
parliament-current topics, parliament/sessions.json for roll-call agreement). Distances between
the parties of a session:
- hellinger: word shares over topics, Hellinger (the published talk tree, the baseline);
- aitchison: CLR of the shares (+0.5 words per topic), Euclidean, so a topic a party barely
  touches counts as much as a large one in relative terms;
- pooled: Hellinger on the words of the session and its two neighbours, against session noise;
- votes: 1 - agreement;
- talk+votes: the mean of Hellinger and votes, each divided by its largest pair in the session.
Each tree is cut into three groups (average linkage). Checks per set: ARI of the cut between
sessions one and three apart on their common parties (does the grouping persist; pooled windows
overlap at one apart, not at three), topic bootstrap ARI
for the sets that use topics (topics drawn with replacement, votes kept), and for talk sets the
Mantel r with votes. The votes stay fixed in the topic bootstrap, so talk+votes is stable there
partly by construction. Session means with a bootstrap over sessions (1,000 rounds). The lag is
counted in the full session order, so a skipped session leaves a gap and shifts no pair. Pooled
against Hellinger also gets a paired bootstrap over the same session pairs.
"""
from __future__ import annotations

import json
import sys

import numpy as np
import pandas as pd
from scipy.cluster.hierarchy import fcluster
from sklearn.metrics import adjusted_rand_score

from ml.feature_study.report import ROOT, stats, write

sys.path.insert(0, str(ROOT / "platform/publish/clusters"))
import talk_vote as published  # noqa: E402

CUT, BOOT, SEED = published.CUT, 1000, 20261022
TOPIC_ROUNDS = 100


def aitchison(words: np.ndarray) -> np.ndarray:
    logs = stats.clr(words + 0.5)
    return np.linalg.norm(logs[:, None] - logs[None], axis=2)


def scaled(d: np.ndarray) -> np.ndarray:
    return d / max(d.max(), 1e-12)


def cut(distance: np.ndarray) -> np.ndarray:
    return fcluster(published.tree(distance), CUT, "maxclust") - 1


def distances(words: np.ndarray, pooled_words: np.ndarray, vote: np.ndarray) -> dict[str, np.ndarray]:
    shares = words / words.sum(axis=1, keepdims=True)
    pooled = pooled_words / pooled_words.sum(axis=1, keepdims=True)
    talk = published.hellinger(shares)
    return {"hellinger": talk, "aitchison": aitchison(words), "pooled": published.hellinger(pooled),
            "votes": vote, "talk+votes": (scaled(talk) + scaled(vote)) / 2}


def topic_bootstrap(words, pooled_words, vote, name, labels, rng) -> float:
    out = []
    for _ in range(TOPIC_ROUNDS):
        drawn = rng.integers(0, words.shape[1], words.shape[1])
        out.append(adjusted_rand_score(labels, cut(distances(words[:, drawn] + 1e-9, pooled_words[:, drawn] + 1e-9,
                                                             vote)[name])))
    return float(np.mean(out))


def sessions() -> list[dict]:
    topics = pd.DataFrame(json.loads(published.TOPICS.read_text(encoding="utf-8")))
    topics = topics[(topics.model_id == published.MODEL) & (topics.topic_id >= 0)]
    pairs = pd.DataFrame(json.loads(published.VOTES.read_text(encoding="utf-8"))["party_pairs"])
    cube = topics.pivot_table(index=["session", "party"], columns="topic_id", values="words", aggfunc="sum", fill_value=0)
    order = sorted(cube.index.get_level_values(0).unique())
    out = []
    for i, session in enumerate(order):
        votes = pairs[pairs.session == session]
        parties = sorted(set(cube.loc[session].index) & (set(votes.party_a) | set(votes.party_b)))
        if len(parties) < 4:
            continue
        window = [s for s in order[max(0, i - 1):i + 2]]
        pooled = sum(cube.loc[s].reindex(parties, fill_value=0) for s in window)
        agree = {(a, b): v for a, b, v in zip(votes.party_a, votes.party_b, votes.agreement_pct)}
        vote = np.array([[0.0 if a == b else 1 - agree.get((a, b), agree.get((b, a), np.nan)) / 100
                          for b in parties] for a in parties])
        if np.isnan(vote).any():
            continue
        out.append({"session": session, "position": i, "parties": parties, "words": cube.loc[session].loc[parties].to_numpy(float),
                    "pooled": pooled.to_numpy(float), "vote": vote})
    return out


def interval(values, rng) -> dict:
    values = np.asarray(values, float)
    boot = [rng.choice(values, len(values)).mean() for _ in range(BOOT)]
    return {"mean": round(float(values.mean()), 4), "low": round(float(np.percentile(boot, 2.5)), 4),
            "high": round(float(np.percentile(boot, 97.5)), 4), "sessions": int(len(values))}


def lag_pairs(positions: list[int], lag: int) -> list[tuple[int, int]]:
    """Row indices (a, b) whose sessions lie `lag` apart in the full session order."""
    at = {p: i for i, p in enumerate(positions)}
    return [(i, at[p + lag]) for i, p in enumerate(positions) if p + lag in at]


def main() -> None:
    rng = np.random.default_rng(SEED)
    rows = sessions()
    names = ["hellinger", "aitchison", "pooled", "votes", "talk+votes"]
    cuts, boots, mantels = {n: [] for n in names}, {n: [] for n in names if n != "votes"}, {n: [] for n in names[:3]}
    for row in rows:
        d = distances(row["words"], row["pooled"], row["vote"])
        for n in names:
            labels = cut(d[n])
            cuts[n].append(dict(zip(row["parties"], labels)))
            if n in boots:
                boots[n].append(topic_bootstrap(row["words"], row["pooled"], row["vote"], n, labels, rng))
            if n in mantels:
                mantels[n].append(published.mantel(d[n], row["vote"], rounds=1)[0])
    persist, pooled_gain = {}, {}
    for lag in (1, 3):  # pooled windows share sessions at lag 1, none at lag 3
        pairs = lag_pairs([r["position"] for r in rows], lag)
        values = {}
        for n in names:
            values[n] = []
            for i, j in pairs:
                a, b = cuts[n][i], cuts[n][j]
                common = sorted(set(a) & set(b))
                values[n].append(adjusted_rand_score([a[p] for p in common], [b[p] for p in common]))
        persist[f"lag_{lag}"] = {n: interval(v, rng) for n, v in values.items()}
        pooled_gain[f"lag_{lag}"] = interval(np.subtract(values["pooled"], values["hellinger"]), rng)
    write("talk_vote", {"sessions": [r["session"] for r in rows], "cut": CUT,
                        "session_ari": persist, "pooled_minus_hellinger": pooled_gain,
                        "topic_bootstrap_ari": {n: interval(v, rng) for n, v in boots.items()},
                        "mantel_r_with_votes": {n: interval(v, rng) for n, v in mantels.items()}})


if __name__ == "__main__":
    main()
