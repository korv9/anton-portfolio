"""Junior or senior from advertisement body text, with the title removed.

The existing measure reads seniority off the job title. That works, but it only sees the
70% of adverts whose title says so; the rest are 'unspecified' and drop out of the figure
entirely. Learning from the body lets the unspecified ones be estimated too.

The title has to go. It is what the existing rule keys on, so leaving it in means the model
reads the answer off the input and reports it as skill.

The estimate is a sum of calibrated probabilities, not a count of predicted labels. Counting
hard predictions at a 0.5 threshold is biased whenever the classes are unbalanced, and here
they are, roughly one junior to four seniors.

Raw advertisement text never leaves this process. Only aggregates are written.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
from pathlib import Path

import duckdb
import numpy as np
from sklearn.calibration import CalibratedClassifierCV
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import brier_score_loss
from sklearn.model_selection import GroupKFold

from mlkit import metrics, splits

# Built by platform/ingest/jobtech/run_history_pipeline.py. Override with ML_JOBS_DB.
DATABASE = Path(os.environ.get(
    "ML_JOBS_DB", Path(__file__).resolve().parents[3] / "warehouse/jobtech/history.duckdb"))
TABLE = "silver.int_job_ads_enriched"
MIN_CHARS = 300
STABILITY_SEEDS = [1, 2, 3, 4, 5]
SENIORITY_WORDS = re.compile(
    r"\b(junior|senior|jr|sr|nyexaminerad|nyutexaminerad|erfaren|"
    r"trainee|praktikant|lead|principal|chef)\w*", re.IGNORECASE)


def _strip_title(description: str, title: str) -> str:
    """Remove the title and bare seniority words, so the body has to carry the signal."""
    text = description or ""
    if title:
        text = text.replace(title, " ")
    return SENIORITY_WORDS.sub(" ", text)


def _fit(texts, targets, employers, split):
    """TF-IDF and logistic regression, isotonically calibrated on employer-grouped folds.

    Plain cv=5 would calibrate on adverts from employers the classifier was fitted on, and
    learn that their templates are easy: probabilities too confident on exactly the adverts
    that matter. Returns calibrated probabilities for the test rows.
    """
    vectoriser = TfidfVectorizer(max_features=80000, ngram_range=(1, 2), min_df=3,
                                 sublinear_tf=True)
    train_matrix = vectoriser.fit_transform(list(texts[split.train]))
    test_matrix = vectoriser.transform(list(texts[split.test]))
    base = LogisticRegression(max_iter=3000, C=2.0, class_weight="balanced")
    calibration_folds = list(GroupKFold(n_splits=5).split(
        train_matrix, targets[split.train], employers[split.train]))
    calibrated = CalibratedClassifierCV(base, method="isotonic", cv=calibration_folds)
    calibrated.fit(train_matrix, targets[split.train])
    return calibrated.predict_proba(test_matrix)[:, 1]


def run(job_dir: Path, device: str, cached: dict, force: bool,
        transformers: bool = True) -> dict:
    if not DATABASE.is_file():
        raise FileNotFoundError(f"Job advert database not found at {DATABASE}")

    connection = duckdb.connect(str(DATABASE), read_only=True)
    connection.execute("set enable_progress_bar=false")
    labelled = connection.execute(f"""
        select description, title, employer_id, seniority, role_family
        from {TABLE}
        where description is not null and length(description) > {MIN_CHARS}
          and seniority in ('junior', 'senior') and employer_id is not null
    """).fetchall()
    unspecified_count = connection.execute(f"""
        select count(*) from {TABLE}
        where description is not null and length(description) > {MIN_CHARS}
          and seniority = 'unspecified'
    """).fetchone()[0]

    inputs = {"labelled": len(labelled), "unspecified": unspecified_count, "min_chars": MIN_CHARS,
              "calibration": "grouped", "stability_seeds": STABILITY_SEEDS}
    key = hashlib.sha256(json.dumps(inputs, sort_keys=True).encode()).hexdigest()[:16]
    if not force and key in cached:
        print(f"  cached, skipping ({cached[key].parent.name})", flush=True)
        return {**json.loads(cached[key].read_text(encoding="utf-8")), "status": "cached"}

    texts = np.array([_strip_title(row[0], row[1]) for row in labelled], dtype=object)
    targets = np.array([1 if row[3] == "junior" else 0 for row in labelled])
    employers = np.array([str(row[2]) for row in labelled])
    print(f"  {len(texts):,} labelled adverts, {len(set(employers.tolist())):,} employers, "
          f"{targets.mean():.1%} junior", flush=True)

    # Grouped by employer: large employers repost near-identical adverts, so a random split
    # would measure memorisation of one company's template.
    split = splits.grouped_split(employers, test_size=0.3, seed=0)
    splits.assert_no_group_leak(employers, split)

    probabilities = _fit(texts, targets, employers, split)
    predicted = (probabilities >= 0.5).astype(int)
    truth = targets[split.test]
    groups = employers[split.test]

    auc_score = metrics.cluster_bootstrap(metrics.auc, truth, probabilities, groups)
    auc = auc_score["point"]
    brier = float(brier_score_loss(truth, probabilities))
    f1 = metrics.cluster_bootstrap(metrics.macro_f1, truth, predicted, groups)

    # The title rule cannot see these adverts at all: with the title removed it has nothing
    # to read, so its recall on this task is zero by construction. The honest baseline is
    # the majority class.
    majority = np.zeros_like(truth)
    majority_f1 = metrics.cluster_bootstrap(metrics.macro_f1, truth, majority, groups)

    # Estimated share: sum of calibrated probabilities, not a count of hard predictions.
    counted = float(predicted.mean())
    estimated = float(probabilities.mean())
    observed = float(truth.mean())          # held-out fold, what the gate compares against
    overall = float(targets.mean())         # whole labelled set, what the card reports

    # One held-out fold is one draw of employers, and the share comparison turns on a few
    # points. Repeat it on further employer-grouped splits and report how often it holds.
    # The gate stays on seed 0, as declared; this is the evidence for reading it.
    stability = [{"seed": 0, "observed": observed, "estimated": estimated, "counted": counted}]
    for seed in STABILITY_SEEDS:
        other = splits.grouped_split(employers, test_size=0.3, seed=seed)
        splits.assert_no_group_leak(employers, other)
        other_probabilities = _fit(texts, targets, employers, other)
        stability.append({"seed": seed, "observed": float(targets[other.test].mean()),
                          "estimated": float(other_probabilities.mean()),
                          "counted": float((other_probabilities >= 0.5).mean())})
    estimate_errors = [abs(r["estimated"] - r["observed"]) for r in stability]
    count_errors = [abs(r["counted"] - r["observed"]) for r in stability]
    estimate_wins = sum(e < c for e, c in zip(estimate_errors, count_errors))
    print(f"  share, {len(stability)} splits: calibrated sum closer in {estimate_wins}; "
          f"mean abs error {np.mean(estimate_errors):.3f} vs counting "
          f"{np.mean(count_errors):.3f}", flush=True)

    reliability = []
    for low in np.arange(0, 1, 0.1):
        band = (probabilities >= low) & (probabilities < low + 0.1)
        if band.sum() >= 20:
            reliability.append({"bin": round(float(low) + 0.05, 2),
                                "predicted": float(probabilities[band].mean()),
                                "observed": float(truth[band].mean()),
                                "n": int(band.sum())})

    (job_dir / "calibration.json").write_text(json.dumps({
        "reliability": reliability, "brier": brier, "stability": stability,
        "observed_share": observed, "estimated_share": estimated, "counted_share": counted,
    }, ensure_ascii=False, indent=1), encoding="utf-8")

    passed = bool(auc > 0.70 and brier < 0.20
                  and abs(estimated - observed) < abs(counted - observed))

    return {
        "key": key,
        "inputs": inputs,
        "headline": {"name": "TF-IDF + calibrated LR", "metric": "AUC", "value": auc,
                     "low": auc_score["low"], "high": auc_score["high"]},
        "best_baseline": {"name": "Majority class", "metric": "macro-F1",
                          "value": majority_f1["point"], "low": majority_f1["low"],
                          "high": majority_f1["high"]},
        "gate": {
            "rule": "AUC above 0.70, Brier below 0.20, and the calibrated share estimate "
                    "closer to the observed share than counting hard predictions.",
            "passed": passed,
            "detail": f"AUC {auc:.3f}, Brier {brier:.3f}; estimated share {estimated:.3f} "
                      f"against observed {observed:.3f}, counting gives {counted:.3f}.",
        },
        "card": {
            "purpose": "Junior share of job adverts, estimated from body text",
            "label_meaning":
                "The label comes from the existing title-pattern rule: adverts whose title "
                "says junior or senior. It is a rule, not ground truth, so the model can at "
                "best reproduce that rule's judgement — including its mistakes — on adverts "
                "whose titles say nothing.",
            "data": {
                "labelled adverts": f"{len(texts):,}",
                "employers": f"{len(set(employers.tolist())):,}",
                "junior share in labelled data": f"{overall:.1%}",
                "junior share in the held-out fold": f"{observed:.1%}",
                "unlabelled adverts this could reach": f"{unspecified_count:,}",
                "junior share across employer-grouped splits":
                    f"{len(stability)} splits; calibrated sum closer than counting in "
                    f"{estimate_wins}; mean absolute error {np.mean(estimate_errors):.3f} "
                    f"(largest {max(estimate_errors):.3f}) against {np.mean(count_errors):.3f} "
                    f"(largest {max(count_errors):.3f}) for counting",
                "source": "JobTech historical archive. Raw text is never published.",
            },
            "split":
                "Grouped by employer, 30% held out. No employer appears in both folds, "
                "because large employers repost near-identical adverts and a random split "
                "would measure template memorisation. The calibration folds inside the "
                "training set are grouped by employer too. Intervals bootstrap over employers.",
            "baselines": [
                {"name": "Majority class", "metric": "macro-F1", "value": majority_f1["point"],
                 "low": majority_f1["low"], "high": majority_f1["high"]},
            ],
            "also": [
                {"name": "TF-IDF + calibrated LR, threshold 0.5", "metric": "macro-F1",
                 "value": f1["point"], "low": f1["low"], "high": f1["high"]},
                {"name": "TF-IDF + calibrated LR", "metric": "Brier", "value": brier,
                 "low": None, "high": None},
            ],
            "headline": {"name": "TF-IDF + calibrated LR", "metric": "AUC", "value": auc,
                         "low": auc_score["low"], "high": auc_score["high"]},
            "gate": {"rule": "AUC > 0.70, Brier < 0.20, calibrated estimate beats counting.",
                     "passed": passed,
                     "detail": f"AUC {auc:.3f}, Brier {brier:.3f}; estimated junior share "
                               f"{estimated:.3f} against observed {observed:.3f}, counting "
                               f"hard predictions gives {counted:.3f}."},
            "limitations": [
                "The label is a title rule, so this learns to imitate that rule rather than "
                "to measure seniority.",
                "Title text and bare seniority words are stripped from the input. Anything "
                "the body says that correlates with a senior title still counts, so some "
                "leakage through phrasing is likely and unmeasured.",
                "Adverts with unspecified titles may differ systematically from labelled "
                "ones. Applying the model to them is an extrapolation.",
                "The model ranks adverts well, but its junior share for employers it has "
                "not seen can miss by more than ten points, and summing calibrated "
                "probabilities does not reliably beat counting hard predictions (see Data). "
                "Calibration learnt on some employers does not carry to others, so the "
                "share among unspecified adverts is not supported until it does.",
                "An advert is not a hire, and the archive may not cover every vacancy.",
                "Only aggregate shares are published. No employer or advert is identified.",
            ],
        },
    }
