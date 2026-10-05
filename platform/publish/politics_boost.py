"""Gradient boosting on the Riksdag's roll calls: for each party, a model that predicts whether the
party votes Ja on a decision point from the other parties' positions and the committee. Trained on
riksmötet 2024/25, tested on 2025/26, so the test is a later session the model has not seen.

Descriptive, not a judgement: the importance says which other parties' positions carry most
information about a party's position in these two sessions, not who cooperates with whom.

- Rows: every decision point with a recorded position for the party (politics/decisions/*/index.json).
- Label: the party's position is Ja (else Nej or Avstår).
- Features: the other seven parties' positions (Ja 1, Avstår 0, Nej −1, missing 0) and the
  committee (one-hot, committees with at least 15 points in training).
- Model: scikit-learn GradientBoostingClassifier, 150 trees of depth 2, learning rate 0.1.
- Reported: test accuracy against always guessing the training majority, ROC AUC, accuracy as the
  trees are added (every 5), importance summed per other party and for the committee, and test
  accuracy per committee.

Writes frontend/public/data/politics/parliament/boost.json.

    python platform/publish/politics_boost.py
"""
from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "frontend/public/data"
OUT = DATA / "politics/parliament/boost.json"
PARTIES = ["V", "MP", "S", "C", "L", "KD", "M", "SD"]
TRAIN, TEST = "2024-25", "2025-26"
CODE = {"Ja": 1.0, "Avstår": 0.0, "Nej": -1.0}
SEED = 0


def points(session: str) -> list[dict]:
    rows = json.loads((DATA / f"politics/decisions/{session}/index.json").read_text(encoding="utf-8"))
    out = []
    for r in rows:
        pos = {p["party"]: p.get("party_position") for p in r.get("parties", []) if p.get("party") in PARTIES}
        if len(pos) >= 6:
            out.append({"committee": r.get("committee") or "?", "positions": pos})
    return out


def matrix(rows: list[dict], party: str, committees: list[str]):
    others = [p for p in PARTIES if p != party]
    keep = [r for r in rows if r["positions"].get(party) in CODE]
    x = np.array([[CODE.get(r["positions"].get(o), 0.0) for o in others]
                  + [1.0 if r["committee"] == c else 0.0 for c in committees] for r in keep])
    y = np.array([1 if r["positions"][party] == "Ja" else 0 for r in keep])
    return x, y, [r["committee"] for r in keep], others


def fit_party(train: list[dict], test: list[dict], party: str, committees: list[str]) -> dict:
    from sklearn.ensemble import GradientBoostingClassifier
    from sklearn.metrics import roc_auc_score

    x, y, _, others = matrix(train, party, committees)
    xt, yt, comm_t, _ = matrix(test, party, committees)
    model = GradientBoostingClassifier(n_estimators=150, max_depth=2, learning_rate=0.1, random_state=SEED).fit(x, y)
    majority = int(y.mean() >= 0.5)
    pred = model.predict(xt)
    staged = [float((p == yt).mean()) for p in model.staged_predict(xt)]
    imp = model.feature_importances_
    importance = {o: round(float(imp[i]), 4) for i, o in enumerate(others)}
    importance["committee"] = round(float(imp[len(others):].sum()), 4)
    by_committee = {}
    for c in sorted(set(comm_t)):
        mask = np.array([k == c for k in comm_t])
        if mask.sum() >= 10:
            by_committee[c] = {"n": int(mask.sum()), "accuracy": round(float((pred[mask] == yt[mask]).mean()), 3)}
    return {
        "party": party,
        "train_points": int(len(y)),
        "test_points": int(len(yt)),
        "share_ja_train": round(float(y.mean()), 3),
        "accuracy": round(float((pred == yt).mean()), 3),
        "baseline": round(float((yt == majority).mean()), 3),
        "roc_auc": round(float(roc_auc_score(yt, model.predict_proba(xt)[:, 1])), 3) if len(set(yt)) > 1 else None,
        "staged": [round(staged[i], 3) for i in range(0, len(staged), 5)] + [round(staged[-1], 3)],
        "importance": importance,
        "by_committee": by_committee,
    }


def main() -> int:
    train, test = points(TRAIN), points(TEST)
    counts = Counter(r["committee"] for r in train)
    committees = sorted(c for c, n in counts.items() if n >= 15)
    out = {
        "method": {
            "data": f"Decision points with party positions, riksmöte {TRAIN.replace('-', '/')} (training) and {TEST.replace('-', '/')} (test)",
            "label": "The party's position is Ja (else Nej or Avstår)",
            "features": "The other seven parties' positions (Ja 1, Avstår 0, Nej −1) and the committee (one-hot)",
            "model": "scikit-learn GradientBoostingClassifier: 150 trees, depth 2, learning rate 0.1",
            "note": "Importance describes which positions carry information about a party's position in these sessions; it is not a measure of cooperation.",
        },
        "train_session": TRAIN.replace("-", "/"),
        "test_session": TEST.replace("-", "/"),
        "committees": committees,
        "staged_step": 5,
        "parties": [fit_party(train, test, p, committees) for p in PARTIES],
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    for p in out["parties"]:
        top = max((k for k in p["importance"]), key=lambda k: p["importance"][k])
        print(f"{p['party']:>3}: acc {p['accuracy']} (baseline {p['baseline']}), AUC {p['roc_auc']}, top {top}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
