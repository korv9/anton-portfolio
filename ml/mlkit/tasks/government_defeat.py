"""Will the government lose this vote? Read from the agenda item alone.

The label is a roll call where the government took a yes or no position and lost. Abstentions,
split positions and votes without a government position are left out. Defeats are rare (about
3%) and cluster in minority parliaments: 121 in 2021/22, none in 2006/07.

Inputs are the item's title, its committee and whether the point is substantive. The vote
counts and the outcome are the answer and never enter.

Because the base rate swings by session, a model could look good by learning which years were
bad. Folds therefore leave out one whole session at a time, and the headline AUC only compares
items within the same session: given this year's agenda, which items does the government lose?
Points of one committee report are correlated (a lost report often loses several points), so
intervals resample reports, not rows.

Gate, declared before the first run: the text model ranks defeats better than the committee
prior, with the lower bound of the paired bootstrap difference above zero.
"""
from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

import duckdb
import numpy as np
from scipy.sparse import hstack
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import OneHotEncoder

from mlkit import data, metrics, splits

SOURCE = (data.PUBLIC / "parquet/parliament_roll_calls/*.parquet").as_posix()
DESIGNATION = re.compile(r"\s*\([^)]*\)\s*$")
PRIOR_WEIGHT = 20  # pseudo-count pulling a committee's defeat rate toward the overall rate
# Wording that marks an announcement to the government. Masked in an ablation to show how
# much of the ranking is that wording rather than the subject.
DIRECTIVE = re.compile(r"\b(bör|borde|uppmaning\w*|regeringen\w*|tillkännag\w*|riksdagen)\b",
                       re.IGNORECASE)


def load() -> list[tuple]:
    return duckdb.sql(f"""
        select session, session || ':' || upper(designation) as report, upper(committee_code),
               coalesce(title, ''), coalesce(is_substantive, false), not government_won
        from read_parquet('{SOURCE}')
        where government_position in ('yes', 'no') and government_won is not null
    """).fetchall()


def within_session_auc(truth: np.ndarray, packed: np.ndarray) -> float:
    """AUC over pairs from the same session only. `packed` holds the score and a session code,
    so a bootstrap that resamples rows keeps each row's session."""
    scores, sessions = packed[:, 0], packed[:, 1]
    wins = pairs = 0.0
    for session in np.unique(sessions):
        rows = sessions == session
        positive, negative = scores[rows & (truth == 1)], scores[rows & (truth == 0)]
        if len(positive) and len(negative):
            order = np.sort(negative)
            below = np.searchsorted(order, positive, side="left")
            ties = np.searchsorted(order, positive, side="right") - below
            wins += below.sum() + 0.5 * ties.sum()
            pairs += len(positive) * len(negative)
    if not pairs:
        raise ValueError("no session holds both classes")
    return float(wins / pairs)


def committee_prior(committees, targets, train, test) -> np.ndarray:
    overall = targets[train].mean()
    rates = {}
    for committee in np.unique(committees[train]):
        rows = committees[train] == committee
        rates[committee] = ((targets[train][rows].sum() + PRIOR_WEIGHT * overall)
                            / (rows.sum() + PRIOR_WEIGHT))
    return np.array([rates.get(c, overall) for c in committees[test]])


def text_model(titles, committees, substantive, targets, train, test):
    words = TfidfVectorizer(ngram_range=(1, 2), min_df=3, sublinear_tf=True)
    onehot = OneHotEncoder(handle_unknown="ignore")
    meta = np.column_stack([committees, substantive.astype(str)])
    x_train = hstack([words.fit_transform(titles[train]), onehot.fit_transform(meta[train])]).tocsr()
    x_test = hstack([words.transform(titles[test]), onehot.transform(meta[test])]).tocsr()
    model = LogisticRegression(max_iter=3000, C=1.0, class_weight="balanced")
    model.fit(x_train, targets[train])
    names = np.concatenate([words.get_feature_names_out(), onehot.get_feature_names_out()])
    return model.predict_proba(x_test)[:, 1], model.coef_[0], names


def run(job_dir: Path, device: str, cached: dict, force: bool, transformers: bool = True) -> dict:
    rows = load()
    inputs = {"rows": len(rows), "defeats": int(sum(r[5] for r in rows)),
              "source": "parliament_roll_calls", "folds": "leave-one-session-out",
              "prior_weight": PRIOR_WEIGHT,
              "directive_mask": DIRECTIVE.pattern}
    key = hashlib.sha256(json.dumps(inputs, sort_keys=True).encode()).hexdigest()[:16]
    if not force and key in cached:
        print(f"  cached, skipping ({cached[key].parent.name})", flush=True)
        return {**json.loads(cached[key].read_text(encoding="utf-8")), "status": "cached"}

    sessions = np.array([r[0] for r in rows])
    reports = np.array([r[1] for r in rows])
    committees = np.array([r[2] for r in rows])
    titles = np.array([DESIGNATION.sub("", r[3]) for r in rows], dtype=object)
    substantive = np.array([bool(r[4]) for r in rows])
    targets = np.array([int(r[5]) for r in rows])
    print(f"  {len(rows):,} votes, {targets.sum()} defeats, {len(set(reports.tolist())):,} reports, "
          f"{len(set(sessions.tolist()))} sessions", flush=True)

    masked = np.array([DIRECTIVE.sub(" ", t) for t in titles], dtype=object)
    text_scores, prior_scores, masked_scores = (np.zeros(len(rows)) for _ in range(3))
    weights = []
    for session in np.unique(sessions):
        split = splits.temporal_split(sessions, session)
        splits.assert_no_group_leak(sessions, split)
        text_scores[split.test], coef, names = text_model(
            titles, committees, substantive, targets, split.train, split.test)
        masked_scores[split.test] = text_model(
            masked, committees, substantive, targets, split.train, split.test)[0]
        prior_scores[split.test] = committee_prior(committees, targets, split.train, split.test)
        weights.append(coef)

    codes = np.unique(sessions, return_inverse=True)[1].astype(float)
    text_packed = np.column_stack([text_scores, codes])
    prior_packed = np.column_stack([prior_scores, codes])
    headline = metrics.cluster_bootstrap(within_session_auc, targets, text_packed, reports)
    prior = metrics.cluster_bootstrap(within_session_auc, targets, prior_packed, reports)
    gain = metrics.paired_cluster_bootstrap(within_session_auc, targets, text_packed, prior_packed,
                                            reports)
    masked_auc = metrics.cluster_bootstrap(within_session_auc, targets,
                                           np.column_stack([masked_scores, codes]), reports)
    pooled = metrics.cluster_bootstrap(metrics.auc, targets, text_scores, reports)
    null = metrics.permutation_test(lambda t, s: within_session_auc(t, text_packed), targets,
                                    text_scores, iterations=200)

    per_session = []
    for session in np.unique(sessions):
        rows_in = sessions == session
        if 0 < targets[rows_in].sum() < rows_in.sum():
            per_session.append({"session": session, "defeats": int(targets[rows_in].sum()),
                                "votes": int(rows_in.sum()),
                                "auc": metrics.auc(targets[rows_in], text_scores[rows_in])})
    # The last session's coefficients describe a model fitted on every other session.
    order = np.argsort(weights[-1])
    terms = {"toward_defeat": [str(names[i]) for i in order[::-1][:20]],
             "toward_win": [str(names[i]) for i in order[:20]]}
    (job_dir / "detail.json").write_text(json.dumps({"per_session": per_session, "terms": terms,
                                                     "permutation": null}, ensure_ascii=False,
                                                    indent=1), encoding="utf-8")

    passed = bool(gain["low"] is not None and gain["low"] > 0)
    rule = ("Within-session AUC of the text model above the committee prior: lower bound of the "
            "paired bootstrap difference over reports above zero. Declared before the first run.")
    detail = (f"Within-session AUC {headline['point']:.3f} against {prior['point']:.3f} for the "
              f"committee prior; difference {gain['point']:+.3f} "
              f"({gain['low']:+.3f} to {gain['high']:+.3f}).")
    row = lambda name, metric, s: {"name": name, "metric": metric, "value": s["point"],
                                   "low": s["low"], "high": s["high"]}
    card_headline = row("Title + committee, TF-IDF LR", "within-session AUC", headline)
    return {
        "key": key, "inputs": inputs, "headline": card_headline,
        "best_baseline": row("Committee prior", "within-session AUC", prior),
        "gate": {"rule": rule, "passed": passed, "detail": detail},
        "card": {
            "purpose": "Government defeats in Riksdag roll calls, ranked from the agenda item",
            "label_meaning":
                "A roll call where the government took a yes or no position and the chamber "
                "voted the other way. It is recorded fact, not a judgement. It says nothing "
                "about why the government lost.",
            "data": {
                "votes": f"{len(rows):,}", "defeats": f"{targets.sum():,}",
                "committee reports": f"{len(set(reports.tolist())):,}",
                "sessions": f"{min(sessions.tolist())} to {max(sessions.tolist())}",
                "defeats per session": f"0 to {max(p['defeats'] for p in per_session)}; "
                                       "concentrated in minority parliaments",
                "permutation p-value (200 shuffles)": f"{null['p_value']:.3f}",
                "source": "Riksdag open data, roll calls as served under parquet/.",
            },
            "split":
                "Leave one session out: each session is predicted by a model that never saw it. "
                "The headline only compares items within one session, so learning which years "
                "were bad earns nothing. Intervals bootstrap committee reports.",
            "baselines": [row("Committee prior", "within-session AUC", prior)],
            "also": [row("Title + committee, TF-IDF LR", "pooled AUC", pooled),
                     row("Text model minus committee prior", "AUC difference", gain),
                     row("Same, directive wording masked", "within-session AUC", masked_auc)],
            "headline": card_headline,
            "gate": {"rule": rule, "passed": passed, "detail": detail},
            "limitations": [
                "Titles are written by the Riksdag after the committee has drafted its report, "
                "and phrasing such as 'Uppmaning till regeringen' already marks an "
                "announcement the committee majority wants. Masking that wording moves the "
                f"within-session AUC from {headline['point']:.3f} to {masked_auc['point']:.3f}, "
                "so the title still describes the committee's report, not the floor debate.",
                "Sessions with a majority government have almost no defeats and add nothing to "
                "the ranking. The result describes minority parliaments.",
                "Each roll call is a point of a report. Points are not independent; the "
                "bootstrap resamples reports for that reason.",
                "Titles before about 2005 are short headings, later ones are full sentences, "
                "so text carries different amounts of information across the period.",
            ],
        },
    }
