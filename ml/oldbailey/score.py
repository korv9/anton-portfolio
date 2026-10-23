"""Old Bailey extraction: score gemma and the baselines against the hand tags, and export the result.

    python -m ml.oldbailey.score

Scores are fixed in docs/oldbailey-extraction-preregistration.md: accuracy and macro-F1 with
bootstrap intervals, the paired gemma-minus-keyword difference, accuracy per period, confusion
matrices and invalid answers. Reads trials.parquet and counts.json (ml.oldbailey.trials) and
gemma-sample.jsonl (ml.oldbailey.extract), and refuses to export until every sampled trial has an
answer. Writes frontend/public/data/humanities/oldbailey/extraction.json: counts and scores only,
no trial text, names or per-trial predictions.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.metrics import f1_score

from ml.oldbailey import extract
from ml.oldbailey.rules import FIELDS, predict
from ml.oldbailey.trials import OUT, REPO, ZIP

EXPORT = REPO / "frontend/public/data/humanities/oldbailey/extraction.json"
ROUNDS, SEED = 1000, 1
METHODS = ("gemma", "keyword", "majority")


def interval(values: np.ndarray) -> list[float]:
    return [round(float(v), 4) for v in np.percentile(values, [2.5, 97.5])]


def field_scores(gold: pd.Series, predicted: dict[str, pd.Series], rng_seed: int = SEED) -> dict:
    """Accuracy and macro-F1 per method with bootstrap intervals; gemma minus keyword, paired."""
    scored = gold.notna()
    gold = gold[scored].astype(str)
    hits = {m: (p[scored].fillna("invalid").astype(str) == gold).to_numpy() for m, p in predicted.items()}
    labels, truth = sorted(gold.unique()), gold.to_numpy()
    rng = np.random.default_rng(rng_seed)
    draws = rng.integers(0, len(gold), size=(ROUNDS, len(gold)))
    out = {"n": int(len(gold)), "methods": {}}
    for method, hit in hits.items():
        guess = predicted[method][scored].fillna("invalid").astype(str).to_numpy()
        # A resample can miss a rare class; each draw averages over the classes it contains.
        f1 = [f1_score(truth[d], guess[d], labels=np.unique(truth[d]), average="macro", zero_division=0)
              for d in draws]
        out["methods"][method] = {
            "accuracy": round(float(hit.mean()), 4),
            "accuracy_ci95": interval(hit[draws].mean(axis=1)),
            "macro_f1": round(float(f1_score(gold, guess, labels=labels, average="macro", zero_division=0)), 4),
            "macro_f1_ci95": interval(np.asarray(f1)),
        }
    if {"gemma", "keyword"} <= hits.keys():
        difference = hits["gemma"].astype(float) - hits["keyword"]
        low, high = interval(difference[draws].mean(axis=1))
        out["gemma_minus_keyword"] = {"accuracy": round(float(difference.mean()), 4), "ci95": [low, high],
                                      "excludes_zero": bool(low > 0 or high < 0)}
    return out


def confusion(gold: pd.Series, guess: pd.Series) -> dict:
    scored = gold.notna()
    table = pd.crosstab(gold[scored].astype(str), guess[scored].fillna("invalid").astype(str))
    return {"rows": table.index.tolist(), "columns": table.columns.tolist(), "counts": table.to_numpy().tolist()}


def gemma_answers(path: Path) -> pd.DataFrame:
    rows = [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]
    frame = pd.DataFrame([{k: r[k] for k in ("trial_id", *FIELDS)} for r in rows])
    frame.attrs["usage"] = {k: round(float(sum(r[k] for r in rows)), 1) for k in ("tokens_in", "tokens_out", "neurons")}
    return frame.set_index("trial_id")


def build(trials: pd.DataFrame, gemma: pd.DataFrame, counts: dict) -> dict:
    sample = trials[trials["split"] == "sample"].set_index("trial_id")
    missing = sample.index.difference(gemma.index)
    if len(missing):
        raise SystemExit(f"{len(missing):,} sampled trials have no gemma answer yet; run ml.oldbailey.extract")
    baselines = predict(trials)
    predicted = {"gemma": gemma.loc[sample.index]}
    for method in ("keyword", "majority"):
        predicted[method] = baselines[baselines["method"] == method].set_index("trial_id").loc[sample.index]
    fields, periods = {}, {}
    for field in FIELDS:
        fields[field] = field_scores(sample[field], {m: predicted[m][field] for m in METHODS})
        fields[field]["invalid_gemma"] = int(predicted["gemma"][field].isna().sum())
        fields[field]["confusion"] = {m: confusion(sample[field], predicted[m][field]) for m in ("gemma", "keyword")}
        periods[field] = []
        for period, part in sample.groupby("period"):
            scored = part[field].notna()
            periods[field].append({"period": period, "n": int(scored.sum()), **{
                m: round(float((predicted[m].loc[part.index, field][scored] == part[field][scored]).mean()), 4)
                for m in METHODS}})
    return {
        "schema_version": 1,
        "name": "oldbailey-extraction",
        "title": "Reading the Old Bailey: model labels against the clerks' tags",
        "method": {
            "preregistration": "docs/oldbailey-extraction-preregistration.md",
            "source": {"name": "Old Bailey Online XML Data, version 7.2", "file": ZIP.name,
                       "doi": "10.15131/shef.data.4775434.v2", "licence": "CC BY-NC 4.0",
                       "attribution": "Old Bailey Online (University of Sheffield, University of "
                                      "Hertfordshire, The Open University), www.oldbaileyonline.org"},
            "model": extract.MODEL,
            "prompt_sha256": hashlib.sha256(extract.SYSTEM.encode()).hexdigest(),
            "sample": {"per_period": 500, "seed": 20261022, "periods": sorted(sample["period"].unique()),
                       "trial_ids_sha256": hashlib.sha256("\n".join(sorted(sample.index)).encode()).hexdigest()},
            "bootstrap": {"rounds": ROUNDS, "seed": SEED},
            "usage": gemma.attrs.get("usage"),
            "amendments": [],
        },
        "coverage": counts,
        "fields": fields,
        "by_period": periods,
    }


def main() -> None:
    trials = pd.read_parquet(OUT / "trials.parquet", columns=["trial_id", "year", "period", "split", "text",
                                                               *FIELDS])
    counts = json.loads((OUT / "counts.json").read_text(encoding="utf-8"))
    result = build(trials, gemma_answers(extract.FEATURES / "gemma-sample.jsonl"), counts)
    EXPORT.parent.mkdir(parents=True, exist_ok=True)
    EXPORT.write_text(json.dumps(result, indent=1, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")
    print(json.dumps({f: {m: s["accuracy"] for m, s in v["methods"].items()} for f, v in result["fields"].items()}))


if __name__ == "__main__":
    main()
