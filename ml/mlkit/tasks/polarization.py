"""Are parties becoming easier to tell apart by how they speak?

A party classifier is fitted per session and the headline is the mean pairwise AUC. Rising
separability is not the same as rising polarization, so the card refuses to let the headline
stand alone:

  permutation   shuffled party labels, to show what the floor actually is
  role          the governing parties are listed per session, since being in office
                changes the register regardless of position
  topic         not controlled. Parties that talk about different things separate more
                easily; the card says so rather than implying otherwise

Speeches from issue debates and party-leader debates are both used. Folds are grouped by the
Riksdag's person id: the speaker string varies for one person across titles and sessions, so
grouping on it would let the same person sit on both sides.

TF-IDF runs across every session. KB-BERT runs on six, to show the two agree on direction;
if they disagree that is a finding, not a failure. It needs a GPU in practice and is skipped
with --no-transformers, in which case the card says it was not run.
"""
from __future__ import annotations

import hashlib
import json
from collections import Counter
from pathlib import Path

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline

from mlkit import data, metrics, splits

BERT_SESSIONS = ["1993/94", "2002/03", "2010/11", "2015/16", "2020/21", "2025/26"]
BERT_MODEL = "KB/bert-base-swedish-cased"
BERT_MAX_LEN = 256
BERT_BATCH = 16
BERT_EPOCHS = 2
MIN_PER_PARTY = 25
# Governing parties for most of each session (October to September), for the role
# control. Source: Regeringskansliet. 2021/22: S with MP until 30 November 2021, S alone after.
GOVERNMENT = {
    "1993/94": {"M", "C", "L", "KD"},
    **{s: {"S"} for s in ["1994/95", "1995/96", "1996/97", "1997/98", "1998/99",
                          "1999/2000", "2000/01", "2001/02", "2002/03", "2003/04",
                          "2004/05", "2005/06"]},
    **{s: {"M", "C", "L", "KD"} for s in ["2006/07", "2007/08", "2008/09", "2009/10",
                                          "2010/11", "2011/12", "2012/13", "2013/14"]},
    **{s: {"S", "MP"} for s in ["2014/15", "2015/16", "2016/17", "2017/18", "2018/19",
                                "2019/20", "2020/21"]},
    "2021/22": {"S"},
    **{s: {"M", "KD", "L"} for s in ["2022/23", "2023/24", "2024/25", "2025/26"]},
}


def _balanced(rows: list[dict], seed: int = 0) -> list[dict]:
    """Equal passages per party, so AUC reflects language rather than who talks most."""
    rng = np.random.default_rng(seed)
    by_party: dict[str, list[dict]] = {}
    for row in rows:
        by_party.setdefault(row["party"], []).append(row)
    usable = {p: r for p, r in by_party.items() if len(r) >= MIN_PER_PARTY}
    if len(usable) < 2:
        return []
    size = min(len(r) for r in usable.values())
    out = []
    for party, party_rows in usable.items():
        picked = rng.choice(len(party_rows), size=size, replace=False)
        out.extend(party_rows[i] for i in picked)
    return out


def _session_auc(rows: list[dict], seed: int = 0) -> dict | None:
    """Mean pairwise AUC for one session, split so no speaker crosses the fold."""
    rows = _balanced(rows, seed)
    if not rows:
        return None
    texts = np.array([r["text"] for r in rows], dtype=object)
    parties = np.array([r["party"] for r in rows])
    people = np.array([r["person"] for r in rows])
    labels = sorted(set(parties.tolist()))
    if len(labels) < 2:
        return None

    split = splits.grouped_split(people, test_size=0.3, seed=seed)
    if len(set(parties[split.test].tolist())) < 2:
        return None

    model = make_pipeline(
        TfidfVectorizer(max_features=40000, ngram_range=(1, 2), min_df=2, sublinear_tf=True),
        LogisticRegression(max_iter=2000, C=2.0, class_weight="balanced"),
    )
    model.fit(list(texts[split.train]), parties[split.train])
    order = list(model.classes_)
    scores = model.predict_proba(list(texts[split.test]))
    pairwise = metrics.mean_pairwise_auc(parties[split.test], scores, order)
    if pairwise["mean_auc"] is None:
        return None

    predicted = np.array([order[i] for i in scores.argmax(1)])
    permuted = metrics.permutation_test(
        metrics.macro_f1, parties[split.test], predicted, iterations=300, seed=seed)
    return {"mean_auc": pairwise["mean_auc"], "pairs": pairwise["pairs"],
            "permutation": permuted, "passages": len(rows), "parties": labels}


def _bert_session_auc(rows: list[dict], job_dir: Path, session: str, device: str):
    """Mean pairwise AUC for one session with KB-BERT, on the same speaker-grouped split.

    Run on a handful of sessions only, to check whether the cheap estimator and an
    expensive one point the same way. Disagreement is a result worth reporting, not a bug.
    """
    import torch
    from torch.utils.data import DataLoader, Dataset
    from transformers import AutoModelForSequenceClassification, AutoTokenizer

    rows = _balanced(rows, seed=0)
    if not rows:
        return None
    texts = np.array([r["text"] for r in rows], dtype=object)
    parties = np.array([r["party"] for r in rows])
    people = np.array([r["person"] for r in rows])
    labels = sorted(set(parties.tolist()))
    if len(labels) < 2:
        return None

    split = splits.grouped_split(people, test_size=0.3, seed=0)
    splits.assert_no_group_leak(people, split)
    if len(set(parties[split.test].tolist())) < 2:
        return None

    index = {label: i for i, label in enumerate(labels)}
    tokenizer = AutoTokenizer.from_pretrained(BERT_MODEL)

    class Passages(Dataset):
        def __init__(self, items, targets=None):
            self.items, self.targets = items, targets

        def __len__(self):
            return len(self.items)

        def __getitem__(self, i):
            encoded = tokenizer(self.items[i], truncation=True, max_length=BERT_MAX_LEN,
                                padding="max_length", return_tensors="pt")
            item = {k: v.squeeze(0) for k, v in encoded.items()}
            if self.targets is not None:
                item["labels"] = torch.tensor(index[self.targets[i]])
            return item

    try:
        torch_device = torch.device("cuda" if device != "cpu" and torch.cuda.is_available() else "cpu")
        model = AutoModelForSequenceClassification.from_pretrained(
            BERT_MODEL, num_labels=len(labels)).to(torch_device)
    except (RuntimeError, OSError):
        torch_device = torch.device("cpu")
        model = AutoModelForSequenceClassification.from_pretrained(
            BERT_MODEL, num_labels=len(labels)).to(torch_device)

    loader = DataLoader(Passages(list(texts[split.train]), parties[split.train]),
                        batch_size=BERT_BATCH, shuffle=True)
    optimiser = torch.optim.AdamW(model.parameters(), lr=2e-5)
    model.train()
    for epoch in range(BERT_EPOCHS):
        for batch in loader:
            batch = {k: v.to(torch_device) for k, v in batch.items()}
            model(**batch).loss.backward()
            optimiser.step()
            optimiser.zero_grad()
        torch.save(model.state_dict(), job_dir / f"bert-{session.replace('/', '-')}.pt")

    model.eval()
    scores = []
    with torch.no_grad():
        for batch in DataLoader(Passages(list(texts[split.test])), batch_size=BERT_BATCH * 2):
            batch = {k: v.to(torch_device) for k, v in batch.items()}
            scores.append(torch.softmax(model(**batch).logits, -1).cpu().numpy())
    pairwise = metrics.mean_pairwise_auc(parties[split.test], np.vstack(scores), labels)
    del model
    if torch_device.type == "cuda":
        torch.cuda.empty_cache()
    return pairwise["mean_auc"]


def run(job_dir: Path, device: str, cached: dict, force: bool,
        transformers: bool = True) -> dict:
    cards = data.party_speeches()
    sessions = sorted({c["session"] for c in cards})
    kinds = Counter(c["kind"] for c in cards)
    inputs = {"sessions": len(sessions), "cards": len(cards),
              "bert": BERT_SESSIONS if transformers else [], "group": "person_id"}
    key = hashlib.sha256(json.dumps(inputs, sort_keys=True).encode()).hexdigest()[:16]
    if not force and key in cached:
        print(f"  cached, skipping ({cached[key].parent.name})", flush=True)
        return {**json.loads(cached[key].read_text(encoding="utf-8")), "status": "cached"}

    per_session, seeds, texts = {}, [0, 1, 2], {}
    for session in sessions:
        subset = texts[session] = data.speech_texts(
            [c for c in cards if c["session"] == session])
        if len(subset) < MIN_PER_PARTY * 2:
            continue
        runs = [r for r in (_session_auc(subset, seed) for seed in seeds) if r]
        if not runs:
            continue
        values = [r["mean_auc"] for r in runs]
        governing = GOVERNMENT.get(session, set())
        per_session[session] = {
            "mean_auc": float(np.mean(values)),
            "low": float(np.percentile(values, 2.5)) if len(values) > 2 else None,
            "high": float(np.percentile(values, 97.5)) if len(values) > 2 else None,
            "passages": runs[0]["passages"],
            "parties": runs[0]["parties"],
            "permutation_p": runs[0]["permutation"]["p_value"],
            "permutation_null": runs[0]["permutation"]["null_mean"],
            "governing_parties": sorted(governing),
            "pairs": runs[0]["pairs"],
        }
        print(f"  {session}: AUC {per_session[session]['mean_auc']:.3f} "
              f"(p={per_session[session]['permutation_p']:.3f}, "
              f"{per_session[session]['passages']} passages)", flush=True)

    if not per_session:
        raise RuntimeError("No session had enough balanced passages")

    # KB-BERT on a few sessions, to see whether the cheap estimator points the same way.
    bert = {}
    for session in BERT_SESSIONS if transformers else []:
        if session not in per_session:
            continue
        subset = texts[session]
        value = _bert_session_auc(subset, job_dir, session, device)
        if value is not None:
            bert[session] = {"bert_auc": value, "tfidf_auc": per_session[session]["mean_auc"]}
            print(f"  KB-BERT {session}: AUC {value:.3f} "
                  f"(TF-IDF {per_session[session]['mean_auc']:.3f})", flush=True)

    if len(bert) > 1:
        paired = sorted(bert)
        agreement = float(np.corrcoef([bert[s]["bert_auc"] for s in paired],
                                      [bert[s]["tfidf_auc"] for s in paired])[0, 1])
    else:
        agreement = None

    ordered = sorted(per_session)
    values = [per_session[s]["mean_auc"] for s in ordered]
    if len(values) > 2:
        # Slope per session with its standard error. Sessions are consecutive years, so this
        # is a descriptive trend, not a test: neighbouring sessions share speakers and issues.
        (trend, _), covariance = np.polyfit(range(len(values)), values, 1, cov=True)
        trend, trend_se = float(trend), float(np.sqrt(covariance[0, 0]))
    else:
        trend, trend_se = 0.0, None
    headline = float(np.mean(values))
    spread = f"{min(values):.3f} to {max(values):.3f}"
    bert_note = ("not run: this run used --no-transformers (no GPU)" if not transformers
                 else f"{len(bert)}")
    null_mean = float(np.mean([per_session[s]["permutation_null"] or 0 for s in ordered]))

    (job_dir / "per_session.json").write_text(
        json.dumps({"tfidf": per_session, "bert": bert, "agreement": agreement,
                    "trend": trend, "trend_se": trend_se},
                   ensure_ascii=False, indent=1), encoding="utf-8")

    # Gate: separability must be distinguishable from the permutation floor in most sessions.
    significant = sum(1 for s in ordered if per_session[s]["permutation_p"] < 0.05)
    passed = bool(significant >= 0.8 * len(ordered) and headline > 0.6)

    return {
        "key": key,
        "inputs": inputs,
        "headline": {"name": "TF-IDF, mean pairwise AUC", "metric": "AUC", "value": headline,
                     "low": None, "high": None},
        "best_baseline": {"name": "Permutation null", "metric": "macro-F1",
                          "value": null_mean, "low": None, "high": None},
        "gate": {
            "rule": "Party separability must beat the permutation null in at least 80% of "
                    "sessions, and mean AUC must exceed 0.60.",
            "passed": passed,
            "detail": f"{significant} of {len(ordered)} sessions significant; mean AUC "
                      f"{headline:.3f}, sessions range {spread}; trend {trend:+.4f} AUC per "
                      f"session" + (f" (SE {trend_se:.4f})." if trend_se else "."),
        },
        "card": {
            "purpose": "How distinguishable party language is, by session",
            "label_meaning":
                "The label is the speaker's party. The measure is how well a classifier "
                "separates parties by their words, which is separability, not polarization. "
                "Parties can become easier to tell apart because they disagree more, because "
                "they talk about different things, or because who does the talking changed.",
            "data": {
                "sessions measured": len(ordered),
                "sessions also measured with KB-BERT": bert_note,
                "TF-IDF and KB-BERT correlation across those sessions":
                    f"{agreement:.2f}" if agreement is not None else "not computed",
                "passages per session": "equal per party, "
                                        f"minimum {MIN_PER_PARTY} per party to qualify",
                "per-session AUC range": spread,
                "trend": f"{trend:+.4f} AUC per session"
                         + (f" (OLS standard error {trend_se:.4f}, too small: neighbouring "
                            "sessions share members and issues)" if trend_se else ""),
                "speech cards with a party":
                    f"{len(cards):,} ({kinds.get('issues', 0):,} issue debates, "
                    f"{kinds.get('leaders', 0):,} party-leader debates)",
                "source": "Issue and party-leader debates, Swedish Parliament open data",
                "seeds per session": len(seeds),
            },
            "split":
                "Grouped by person (the Riksdag's person id): no member appears in both folds, "
                "so the classifier cannot win by recognising an individual. Each session is "
                "measured three times with different balanced samples. The headline is the "
                "mean over sessions; the per-session range is in Data, not an interval.",
            "baselines": [
                {"name": "Permutation null (shuffled parties)", "metric": "macro-F1",
                 "value": null_mean, "low": None, "high": None},
            ],
            "headline": {"name": "Mean pairwise AUC", "metric": "AUC", "value": headline,
                         "low": None, "high": None},
            "gate": {"rule": "Beat the permutation null in 80% of sessions, mean AUC > 0.60.",
                     "passed": passed,
                     "detail": f"{significant} of {len(ordered)} sessions significant; "
                               f"mean AUC {headline:.3f}."},
            "limitations": [
                "Separability is not polarization. A rising line may mean parties changed "
                "subject rather than changed position; topic is not controlled.",
                "Issue debates dominate the corpus. Who speaks in them follows committee "
                "seats, so a party's sample leans towards its committee members' subjects.",
                "Governing parties are listed per session so the role effect can be read "
                "alongside the trend; being in office changes register regardless of position.",
                "Coverage differs by session. Older sessions have fewer speeches and coarser "
                "categorisation, so early points rest on less evidence.",
                "Equal passages per party removes volume effects but discards data from "
                "parties that spoke most.",
                "No per-speaker output. The measure is defined only in aggregate.",
            ],
        },
    }
