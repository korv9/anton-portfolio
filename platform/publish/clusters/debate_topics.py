"""Leader-debate topics over time (clustering plan item 5): no new clustering.

    python platform/publish/clusters/debate_topics.py

Reads the published SBERT consensus topics (run 7ddccfed7864e26fe7aa90da, the names on the site)
and the bge-m3 consensus run beside it in cluster_lab/public-consensus-2026-10-13, and the
passages' year, party, speech and debate from the debate dataset. Writes features/clusters/
debate-topics: topic shares per year (clustering debate-topics) and per party and decade
(debate-topics-party), with 90 % intervals from resampling speeches within each cell (a speech's
passages move together); noise is left out of the shares and its share stated. The inputs are
cluster_lab runs that no pipeline step writes; a missing one stops the script. Checks:
- stability: `seed_ari`, the ARI between the 12 HDBSCAN seeds behind the consensus (66 pairs;
  nothing is refitted, so it is seed agreement, not a bootstrap).
- null: Cramer's V of topic x year against the debates' years shuffled over the debates.
- the bge-m3 model: ARI with SBERT, and per topic whether its share trend holds in both
  (best-overlap bge-m3 cluster, Jaccard >= 0.3, yearly shares rank-correlated >= 0.5).
"""
from __future__ import annotations

import itertools
import json
import os
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.stats import spearmanr
from sklearn.metrics import adjusted_mutual_info_score, adjusted_rand_score

import stats

LAB = Path(os.environ.get("PORTFOLIO_CLUSTER_LAB", stats.ROOT / "warehouse/cluster_lab"))
RUN = LAB / "public-consensus-2026-10-13"
OBSERVATIONS = LAB / "public-topics-2026-10-12/datasets/debate/observations.parquet"
NAMES = stats.PUBLIC / "cluster-research/debate-topics.json"
ROUNDS = 200
NULL_ROUNDS = 999


def bootstrap_shares(counts: np.ndarray, rounds: int = ROUNDS, seed: int = stats.SEED) -> tuple:
    """counts: units x clusters. Shares of the cell and their 5-95 % range over units drawn with replacement."""
    rng = np.random.default_rng(seed)
    total = counts.sum(axis=0)
    share = total / max(total.sum(), 1)
    weights = rng.multinomial(len(counts), np.full(len(counts), 1 / len(counts)), size=rounds)
    drawn = weights @ counts
    drawn = drawn / np.maximum(drawn.sum(axis=1, keepdims=True), 1)
    return share, np.percentile(drawn, 5, axis=0), np.percentile(drawn, 95, axis=0)


def cramers_v(a: np.ndarray, b: np.ndarray) -> float:
    table = np.zeros((a.max() + 1, b.max() + 1))
    np.add.at(table, (a, b), 1)
    table = table[table.sum(axis=1) > 0][:, table.sum(axis=0) > 0]
    expected = table.sum(axis=1, keepdims=True) * table.sum(axis=0, keepdims=True) / table.sum()
    chi2 = ((table - expected) ** 2 / expected).sum()
    return float(np.sqrt(chi2 / table.sum() / (min(table.shape) - 1)))


def association_null(cluster: np.ndarray, year: np.ndarray, unit: np.ndarray, rounds: int = NULL_ROUNDS,
                     seed: int = stats.SEED) -> dict:
    """Cramer's V of cluster x year; the null shuffles the years over whole units (debates)."""
    years = np.unique(year, return_inverse=True)[1]
    units, index = np.unique(unit, return_inverse=True)
    unit_year = np.zeros(len(units), dtype=int)
    unit_year[index] = years
    observed = cramers_v(cluster, years)
    rng = np.random.default_rng(seed)
    null = np.array([cramers_v(cluster, rng.permutation(unit_year)[index]) for _ in range(rounds)])
    return {"statistic": "cramers_v topic x year", "kind": "years shuffled over debates",
            "observed": round(observed, 4), "null_median": round(float(np.median(null)), 4),
            "null_95": round(float(np.percentile(null, 95)), 4),
            "p": round((1 + int((null >= observed).sum())) / (1 + rounds), 4), "rounds": rounds, "seed": seed}


def cell_shares(frame: pd.DataFrame, by: list[str], k: int) -> pd.DataFrame:
    rows = []
    for key, cell in frame[frame.cluster >= 0].groupby(by):
        counts = np.zeros((cell.speech_id.nunique(), k))
        np.add.at(counts, (pd.factorize(cell.speech_id)[0], cell.cluster.to_numpy()), 1)
        share, low, high = bootstrap_shares(counts)
        key = key if isinstance(key, tuple) else (key,)
        rows += [[*key, c, round(share[c], 4), round(low[c], 4), round(high[c], 4), len(cell)] for c in range(k)]
    return pd.DataFrame(rows, columns=[*by, "cluster", "share", "low", "high", "passages"])


def topic_agreement(frame: pd.DataFrame, other: np.ndarray) -> list[dict]:
    """Per SBERT topic: best-overlap bge-m3 cluster, Jaccard and the rank correlation of yearly shares."""
    years = sorted(frame.year.unique())
    def yearly(labels, c):
        return [((labels[frame.year == y] == c).sum() / max((labels[frame.year == y] >= 0).sum(), 1)) for y in years]
    mine = frame.cluster.to_numpy()
    out = []
    for c in sorted(set(mine[mine >= 0])):
        inside = mine == c
        candidates = {o: (inside & (other == o)).sum() / (inside | (other == o)).sum() for o in set(other[other >= 0])}
        best = max(candidates, key=candidates.get)
        rho = spearmanr(yearly(mine, c), yearly(other, best)).statistic
        rho = None if np.isnan(rho) else round(float(rho), 3)  # a constant yearly share has no rank correlation
        out.append({"cluster": int(c), "bge_m3_cluster": int(best), "jaccard": round(float(candidates[best]), 3),
                    "rho_yearly": rho, "holds_in_both": bool(candidates[best] >= 0.3 and rho is not None and rho >= 0.5)})
    return out


def main() -> None:
    inputs = [OBSERVATIONS, *(RUN / m / f for m in ("debate-sbert", "debate-bge-m3")
                              for f in ("assignments.parquet", "result.json"))]
    missing = [str(p) for p in inputs if not p.exists()]
    if missing:
        raise SystemExit(f"debate_topics needs the cluster_lab runs public-topics-2026-10-12 and "
                         f"public-consensus-2026-10-13 under {LAB}; no pipeline step writes them. Missing: {missing}")
    observations = pd.read_parquet(OBSERVATIONS, columns=["observation_id", "speech_id", "debate_id", "party", "year"])
    sbert = pd.read_parquet(RUN / "debate-sbert/assignments.parquet")
    bge = pd.read_parquet(RUN / "debate-bge-m3/assignments.parquet")
    frame = observations.merge(sbert[["observation_id", "cluster"]], on="observation_id", validate="one_to_one")
    other = frame[["observation_id"]].merge(bge[["observation_id", "cluster"]], on="observation_id", how="left",
                                            validate="one_to_one").cluster.fillna(-1).astype(int).to_numpy()
    result = json.loads((RUN / "debate-sbert/result.json").read_text(encoding="utf-8"))
    published = json.loads(NAMES.read_text(encoding="utf-8"))
    if published["run_id"] != result["run_id"]:
        raise SystemExit(f"Published names belong to run {published['run_id']}, not {result['run_id']}")
    seeds = [json.loads(p.read_text(encoding="utf-8"))["labels"] for p in sorted((RUN / "debate-sbert").glob("seed-*.json"))]
    pairs = [adjusted_rand_score(a, b) for a, b in itertools.combinations(seeds, 2)]
    labels = frame.cluster.to_numpy()
    k = int(labels.max() + 1)
    kept = labels >= 0
    frame["decade"] = frame.year // 10 * 10
    by_year = cell_shares(frame, ["year"], k).assign(party="all", clustering="debate-topics")
    by_party = (cell_shares(frame, ["decade", "party"], k).rename(columns={"decade": "year"})
                .assign(clustering="debate-topics-party"))
    shares = pd.concat([by_year, by_party]).rename(columns={"year": "period", "party": "segment"})
    shares["period"] = shares.period.astype(str)
    both = kept & (other >= 0)
    diagnostics = stats.diagnostics(
        labels, round(result["silhouette_cosine"], 4),
        stats.summary(pairs, len(pairs), 0, f"ARI between {len(seeds)} HDBSCAN seeds ({len(pairs)} pairs); "
                                            "seed agreement, nothing refitted on resampled passages"),
        association_null(labels[kept], frame.year.to_numpy()[kept], frame.debate_id.to_numpy()[kept]),
        {"party": round(result["ami"]["party"], 4), "year": round(result["ami"]["year"], 4),
         "bge_m3_clusters": round(float(adjusted_mutual_info_score(labels[both], other[both])), 4)},
        space="centred SBERT vectors, cosine, 5,000-passage sample (from the run)", stability_key="seed_ari")
    clusters = [{"id": int(c), "name": published["names"].get(str(c), [None, None]),
                 "size": int((labels == c).sum())} for c in range(k)]
    metrics = {
        "title": "Leader-debate topics over time",
        "method": {"features": "sentence-bert-swedish-cased passage vectors, centred per speaker",
                   "algorithm": "consensus of 12 UMAP-5D + HDBSCAN seeds (existing run)",
                   "source_run": result["run_id"], "shares": "noise left out; 90 % range from speeches resampled in each cell",
                   "rounds": ROUNDS},
        "diagnostics": diagnostics, "clusters": clusters,
        "bge_m3": {"run_id": json.loads((RUN / "debate-bge-m3/result.json").read_text(encoding="utf-8"))["run_id"],
                   "ari_with_sbert_both_assigned": round(float(adjusted_rand_score(labels[both], other[both])), 4),
                   "both_assigned": int(both.sum()), "topics": topic_agreement(frame, other)},
        "assignments": ["debate-topics"], "members": False, "shares": ["debate-topics", "debate-topics-party"],
    }
    assignments = stats.frame("debate-topics", frame.observation_id, frame.party, frame.year, labels)
    stats.save("debate-topics", frame[["observation_id", "speech_id", "debate_id", "party", "year"]], assignments,
               metrics, shares)


if __name__ == "__main__":
    main()
