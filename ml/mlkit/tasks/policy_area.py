"""Policy area from debate text, learned from committee labels.

Trained on issue-debate speeches whose section title maps to exactly one committee, then
applied to party-leader debates, which carry no committee of their own.

A note on baselines. The plan named the existing exact and Swedish-stem keyword methods as
baselines. They predict *expenditure area*, a different label space with 27 values, so
comparing them here would be comparing scores on different problems. The honest baselines
are the majority class and TF-IDF with logistic regression, and the card says so.

The gate compares KB-BERT and TF-IDF on the same resampled debates (a paired cluster
bootstrap of the difference). Each model's own interval is the wrong yardstick for a
difference: both models find the same debates hard, so their errors are correlated.

KB-BERT needs a GPU in practice (about nine hours on four CPU cores). With --no-transformers
the baselines still run and are reported, the status is 'partial', and the card is left as
the last complete run wrote it.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression

from mlkit import data, metrics, splits

HOLDOUT_SESSION = "2025/26"
MODEL = "KB/bert-base-swedish-cased"
MAX_LEN = 256
BATCH = 16
EPOCHS = 3


def _tfidf_baseline(train_text, train_y, test_text):
    vectoriser = TfidfVectorizer(max_features=60000, ngram_range=(1, 2), min_df=3,
                                 sublinear_tf=True)
    matrix = vectoriser.fit_transform(train_text)
    model = LogisticRegression(max_iter=2000, C=4.0, class_weight="balanced")
    model.fit(matrix, train_y)
    return model.predict(vectoriser.transform(test_text))


def _finetune(train_text, train_y, test_text, labels, job_dir: Path, device: str):
    """Fine-tune KB-BERT. Falls back to CPU if CUDA fails, and says which it used."""
    import torch
    from torch.utils.data import DataLoader, Dataset
    from transformers import AutoModelForSequenceClassification, AutoTokenizer

    index = {label: i for i, label in enumerate(labels)}
    tokenizer = AutoTokenizer.from_pretrained(MODEL)

    class Passages(Dataset):
        def __init__(self, texts, targets=None):
            self.texts, self.targets = texts, targets

        def __len__(self):
            return len(self.texts)

        def __getitem__(self, i):
            encoded = tokenizer(self.texts[i], truncation=True, max_length=MAX_LEN,
                                padding="max_length", return_tensors="pt")
            item = {k: v.squeeze(0) for k, v in encoded.items()}
            if self.targets is not None:
                item["labels"] = torch.tensor(index[self.targets[i]])
            return item

    wanted = device if device != "cpu" else "cpu"
    try:
        torch_device = torch.device("cuda" if wanted != "cpu" and torch.cuda.is_available() else "cpu")
        model = AutoModelForSequenceClassification.from_pretrained(
            MODEL, num_labels=len(labels)).to(torch_device)
    except (RuntimeError, OSError):
        torch_device = torch.device("cpu")
        model = AutoModelForSequenceClassification.from_pretrained(
            MODEL, num_labels=len(labels)).to(torch_device)

    loader = DataLoader(Passages(train_text, train_y), batch_size=BATCH, shuffle=True)
    optimiser = torch.optim.AdamW(model.parameters(), lr=2e-5)
    model.train()
    for epoch in range(EPOCHS):
        total = 0.0
        for step, batch in enumerate(loader):
            batch = {k: v.to(torch_device) for k, v in batch.items()}
            loss = model(**batch).loss
            loss.backward()
            optimiser.step()
            optimiser.zero_grad()
            total += loss.item()
            if step % 100 == 0:
                print(f"    epoch {epoch + 1} step {step}/{len(loader)} loss {total / (step + 1):.3f}",
                      flush=True)
        # Checkpoint per epoch so a crash at 3 a.m. costs one epoch, not the night.
        torch.save(model.state_dict(), job_dir / "checkpoint.pt")

    model.eval()
    predictions = []
    with torch.no_grad():
        for batch in DataLoader(Passages(test_text), batch_size=BATCH * 2):
            batch = {k: v.to(torch_device) for k, v in batch.items()}
            predictions.extend(model(**batch).logits.argmax(-1).cpu().tolist())
    return np.array([labels[i] for i in predictions]), str(torch_device)


def run(job_dir: Path, device: str, cached: dict, force: bool,
        transformers: bool = True) -> dict:
    rows = data.issue_passages()
    texts = np.array([r["text"] for r in rows], dtype=object)
    targets = np.array([r["committee"] for r in rows])
    sections = np.array([r["section_id"] for r in rows])
    sessions = np.array([r["session"] for r in rows])
    labels = sorted(set(targets.tolist()))

    inputs = {"rows": len(rows), "labels": len(labels), "epochs": EPOCHS,
              "model": MODEL if transformers else None, "holdout": HOLDOUT_SESSION,
              "gate": "paired"}
    key = hashlib.sha256(json.dumps(inputs, sort_keys=True).encode()).hexdigest()[:16]
    if not force and key in cached:
        print(f"  cached, skipping ({cached[key].parent.name})", flush=True)
        return {**json.loads(cached[key].read_text(encoding="utf-8")), "status": "cached"}

    # Temporal holdout: the claim is that this transfers forward, so the test set is later.
    split = splits.temporal_split(sessions, HOLDOUT_SESSION)
    splits.assert_no_group_leak(sections, split)

    train_text, test_text = list(texts[split.train]), list(texts[split.test])
    train_y, test_y = targets[split.train], targets[split.test]
    test_groups = sections[split.test]

    majority = np.full(len(test_y), max(set(train_y.tolist()), key=list(train_y).count))
    majority_score = metrics.cluster_bootstrap(metrics.macro_f1, test_y, majority, test_groups)
    print(f"  majority macro-F1 {majority_score['point']:.3f}", flush=True)

    tfidf = _tfidf_baseline(train_text, train_y, test_text)
    tfidf_score = metrics.cluster_bootstrap(metrics.macro_f1, test_y, tfidf, test_groups)
    print(f"  tf-idf macro-F1 {tfidf_score['point']:.3f} "
          f"[{tfidf_score['low']:.3f}, {tfidf_score['high']:.3f}]", flush=True)

    baselines = {
        "majority": {"name": "Majority class", "metric": "macro-F1",
                     "value": majority_score["point"], "low": majority_score["low"],
                     "high": majority_score["high"]},
        "tfidf": {"name": "TF-IDF + LR", "metric": "macro-F1", "value": tfidf_score["point"],
                  "low": tfidf_score["low"], "high": tfidf_score["high"]},
    }
    if not transformers:
        return {
            "key": key, "inputs": inputs, "status": "partial",
            "headline": None, "best_baseline": baselines["tfidf"],
            "note": "KB-BERT not run (--no-transformers). Baselines only; the card is left "
                    "as the last complete run wrote it.",
            "data": {"training passages": len(split.train), "holdout passages": len(split.test),
                     "committees": len(labels),
                     "debate sections": len(set(sections.tolist()))},
            "baselines": baselines,
        }

    predicted, used_device = _finetune(train_text, train_y, test_text, labels, job_dir, device)
    bert_score = metrics.cluster_bootstrap(metrics.macro_f1, test_y, predicted, test_groups)
    print(f"  KB-BERT macro-F1 {bert_score['point']:.3f} "
          f"[{bert_score['low']:.3f}, {bert_score['high']:.3f}]", flush=True)

    # Gate: the paired difference must be above zero across its whole 95% interval.
    difference = metrics.paired_cluster_bootstrap(
        metrics.macro_f1, test_y, predicted, tfidf, test_groups)
    passed = bool(difference["low"] is not None and difference["low"] > 0)
    detail = (f"KB-BERT minus TF-IDF: {difference['point']:+.3f} macro-F1, paired 95% "
              f"interval {difference['low']:+.3f} to {difference['high']:+.3f}.")
    print(f"  {detail}", flush=True)

    (job_dir / "predictions.json").write_text(json.dumps({
        "holdout": HOLDOUT_SESSION,
        "difference": difference,
        "per_committee": {
            label: int((predicted == label).sum()) for label in labels},
    }, ensure_ascii=False, indent=1), encoding="utf-8")

    return {
        "key": key,
        "inputs": inputs,
        "device": used_device,
        "headline": {"name": "KB-BERT", "metric": "macro-F1", "value": bert_score["point"],
                     "low": bert_score["low"], "high": bert_score["high"]},
        "best_baseline": {"name": "TF-IDF + LR", "metric": "macro-F1",
                          "value": tfidf_score["point"], "low": tfidf_score["low"],
                          "high": tfidf_score["high"]},
        "gate": {
            "rule": "KB-BERT macro-F1 minus TF-IDF macro-F1, on the same resampled debates, "
                    "must have a 95% interval entirely above zero.",
            "passed": passed,
            "detail": detail,
        },
        "card": {
            "purpose": "Policy area of a debate passage, learned from committee labels",
            "label_meaning":
                "The label is the Riksdag committee that handled the matter, taken from the "
                "decision point whose title matches the debate section. Committee is a proxy "
                "for policy area, not the thing itself: a committee's remit is administrative "
                "and can span several areas, and one area can be split across committees. A "
                "section whose title matches two committees is excluded rather than resolved.",
            "data": {
                "training passages": f"{len(split.train):,}",
                "holdout passages": f"{len(split.test):,} (session {HOLDOUT_SESSION})",
                "committees": len(labels),
                "debate sections": f"{len(set(sections.tolist())):,}",
                "source": "Issue-debate speeches, Swedish Parliament open data",
            },
            "split":
                f"Temporal: trained on every session before {HOLDOUT_SESSION}, tested on "
                f"{HOLDOUT_SESSION}. Asserted that no debate section appears on both sides. "
                "Intervals are a cluster bootstrap over debate sections, because speeches "
                "within a debate are not independent.",
            "baselines": [baselines["majority"], baselines["tfidf"]],
            "headline": {"name": "KB-BERT", "metric": "macro-F1", "value": bert_score["point"],
                         "low": bert_score["low"], "high": bert_score["high"]},
            "gate": {
                "rule": "The paired 95% interval of KB-BERT minus TF-IDF macro-F1 must lie "
                        "entirely above zero.",
                "passed": passed,
                "detail": detail,
            },
            "limitations": [
                "Committee is a proxy for policy area, not a measurement of it.",
                "The existing keyword methods predict expenditure area, a different label "
                "space, so they are not comparable baselines and are not reported here.",
                "Applying this to party-leader debates is a transfer to a different genre. "
                "Party-leader speeches are broader and less tied to one matter, and the error "
                "of that transfer is not measured by this holdout.",
                "77% of debate sections match a decision point. The rest are excluded, and "
                "whether they differ systematically is unknown.",
                "Output is aggregate shares per session and party. No per-speaker claim is "
                "supported or published.",
            ],
        },
    }
