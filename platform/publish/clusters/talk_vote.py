"""Do parties that talk alike vote alike? (clustering plan item 12, I-11): two trees per session.

    python platform/publish/clusters/talk_vote.py

Talk: each party's word shares over the parliament-current topics (gold fact_topic_session_party,
unassigned speech left out), Hellinger distance. Vote: 1 - agreement over comparable roll calls
(parliament/sessions.json party_pairs). Per session, for the parties in both:
- Mantel r (Pearson over the party pairs) with a party-label permutation p;
- both average-linkage trees (scipy linkage rows) for a tanglegram, and the ARI of their 3-group cuts.
Over sessions: mean r against the per-session permutations, and a bootstrap over sessions.
Stability of the talk tree: topics drawn with replacement, tree recut at 3 groups, ARI with the
original cut. Seven to nine parties per session: the trees are descriptive, not discovered structure.
"""
from __future__ import annotations

import json

import numpy as np
import pandas as pd
from scipy.cluster.hierarchy import fcluster, linkage
from scipy.spatial.distance import squareform
from sklearn.metrics import adjusted_rand_score

import stats

TOPICS = stats.PUBLIC / "gold/tables/fact_topic_session_party.json"
VOTES = stats.PUBLIC / "parliament/sessions.json"
MODEL = "parliament-current"
ROUNDS = 999
BOOT = 100
CUT = 3


def hellinger(shares: np.ndarray) -> np.ndarray:
    root = np.sqrt(shares)
    return np.sqrt(np.maximum(0, 1 - root @ root.T))


def mantel(a: np.ndarray, b: np.ndarray, rounds: int = ROUNDS, seed: int = stats.SEED) -> tuple[float, np.ndarray]:
    """Pearson r over the upper triangles, and r under random relabelling of b's rows and columns."""
    upper = np.triu_indices(len(a), 1)
    r = float(np.corrcoef(a[upper], b[upper])[0, 1])
    rng = np.random.default_rng(seed)
    null = np.empty(rounds)
    for i in range(rounds):
        p = rng.permutation(len(b))
        null[i] = np.corrcoef(a[upper], b[np.ix_(p, p)][upper])[0, 1]
    return r, null


def tree(distance: np.ndarray) -> np.ndarray:
    return linkage(squareform(distance, checks=False), "average")


def topic_bootstrap(shares: np.ndarray, labels: np.ndarray, rounds: int = BOOT, seed: int = stats.SEED) -> list[float]:
    rng = np.random.default_rng(seed)
    out = []
    for _ in range(rounds):
        drawn = shares[:, rng.integers(0, shares.shape[1], shares.shape[1])]
        drawn = drawn / np.maximum(drawn.sum(axis=1, keepdims=True), 1e-12)
        out.append(adjusted_rand_score(labels, fcluster(tree(hellinger(drawn)), CUT, "maxclust")))
    return out


def main() -> None:
    topics = pd.DataFrame(json.loads(TOPICS.read_text(encoding="utf-8")))
    topics = topics[(topics.model_id == MODEL) & (topics.topic_id >= 0)]
    pairs = pd.DataFrame(json.loads(VOTES.read_text(encoding="utf-8"))["party_pairs"])
    sessions, assignments, rs, nulls, boots = [], [], [], [], []
    for session, cell in topics.groupby("session"):
        matrix = cell.pivot_table(index="party", columns="topic_id", values="words", aggfunc="sum", fill_value=0)
        votes = pairs[pairs.session == session]
        parties = sorted(set(matrix.index) & (set(votes.party_a) | set(votes.party_b)))
        if len(parties) < 4:
            continue
        shares = matrix.loc[parties].to_numpy(float)
        shares = shares / shares.sum(axis=1, keepdims=True)
        talk = hellinger(shares)
        agree = {(a, b): v for a, b, v in zip(votes.party_a, votes.party_b, votes.agreement_pct)}
        vote = np.array([[0.0 if a == b else 1 - agree.get((a, b), agree.get((b, a), np.nan)) / 100
                          for b in parties] for a in parties])
        if np.isnan(vote).any():
            raise SystemExit(f"{session}: a party pair lacks agreement")
        r, null = mantel(talk, vote, seed=stats.SEED + len(sessions))
        talk_tree, vote_tree = tree(talk), tree(vote)
        talk_cut, vote_cut = fcluster(talk_tree, CUT, "maxclust") - 1, fcluster(vote_tree, CUT, "maxclust") - 1
        boots.append(np.mean(topic_bootstrap(shares, talk_cut, seed=stats.SEED + len(sessions))))
        rs.append(r)
        nulls.append(null)
        sessions.append({"session": session, "parties": parties, "mantel_r": round(r, 4),
                         "p": round((1 + int((null >= r).sum())) / (1 + ROUNDS), 4),
                         "ari_cuts": round(float(adjusted_rand_score(talk_cut, vote_cut)), 4),
                         "talk_tree": np.round(talk_tree, 4).tolist(), "vote_tree": np.round(vote_tree, 4).tolist()})
        assignments += [stats.frame("talk-vote-talk", parties, parties, session, talk_cut),
                        stats.frame("talk-vote-votes", parties, parties, session, vote_cut)]
    observed = float(np.mean(rs))
    pooled = np.mean(np.vstack(nulls), axis=0)
    rng = np.random.default_rng(stats.SEED)
    boot_r = [np.mean(rng.choice(rs, len(rs))) for _ in range(BOOT)]
    labels = np.concatenate([a.cluster.to_numpy() for a in assignments[::2]])
    diagnostics = stats.diagnostics(
        labels, None,
        stats.summary(boots, BOOT, stats.SEED, f"talk tree per session: topics drawn with replacement, "
                                                f"recut at {CUT} groups; mean of the session means"),
        {"statistic": "mean Mantel r over sessions", "kind": "party labels permuted within each session",
         "observed": round(observed, 4), "null_median": round(float(np.median(pooled)), 4),
         "null_95": round(float(np.percentile(pooled, 95)), 4),
         "p": round((1 + int((pooled >= observed).sum())) / (1 + ROUNDS), 4), "rounds": ROUNDS, "seed": stats.SEED,
         "bootstrap_over_sessions": stats.summary(boot_r, BOOT, stats.SEED, "sessions drawn with replacement")},
        {}, note="Descriptive: 7-9 parties per session. Silhouette is not defined for a 3-group cut of so few parties.")
    metrics = {"title": "Talk alike, vote alike?",
               "method": {"talk": f"Hellinger distance between word shares over the {MODEL} topics",
                          "vote": "1 - roll-call agreement", "trees": "average linkage", "cut": CUT,
                          "test": "Mantel, Pearson over party pairs"},
               "diagnostics": diagnostics, "clusters": [], "sessions": sessions,
               "assignments": ["talk-vote-talk", "talk-vote-votes"], "members": True, "shares": False}
    inputs = topics[["session", "party", "topic_id", "words"]].reset_index(drop=True)
    stats.save("talk-vote", inputs, pd.concat(assignments, ignore_index=True), metrics)


if __name__ == "__main__":
    main()
