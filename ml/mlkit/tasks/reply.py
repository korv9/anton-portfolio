"""Does a speech draw a reply? Read from its opening lines.

In a Riksdag debate each main speech can be followed by an exchange of replies before the next
main speech. The label is whether that exchange exists: at least one reply between this main
speech and the next. It is read off the order of the protocol, so it is recorded, not judged.

The question is whether the words add anything beyond who speaks and when. Party and position
in the debate explain a lot on their own: the first speakers on a committee report are its
rapporteurs and the main opposition voices. So the baseline is party, position and debate kind,
and the text model gets the same inputs plus the speech's opening (the excerpt the site serves,
about 260 characters).

Replies are only marked in the protocols from 2003/04, and interpellations, question time and
some set-piece debates have no replies by format. A first run on everything scored AUC 0.88 by
recognising era and format from the wording, so only debates from 2003/04 that contain at least
one reply are used: within a debate where members did reply, which speeches drew it?

Folds hold out whole debates, and intervals resample debates. Two further splits check what a
debate split cannot: one holds out speakers, so a speaker's habits cannot carry over, and one
holds out the last four sessions.

Gate, declared before the first run: text and metadata beat metadata alone on held-out debates,
with the lower bound of the paired bootstrap AUC difference above 0.01.
"""
from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

import duckdb
import numpy as np
from mlkit import data, metrics, splits
from scipy.sparse import hstack
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import OneHotEncoder

SOURCE = (data.PUBLIC / "parquet/speech_cards/*/*.parquet").as_posix()
MAX_POSITION = 12
LATEST = ["2022/23", "2023/24", "2024/25", "2025/26"]
FIRST_MARKED = "2003/04"  # replies are not marked in earlier protocols
OPENING = re.compile(r"^\s*(fru|herr)\s+talman\s*!?\s*", re.IGNORECASE)


def load() -> list[dict]:
    """Main speeches with their label. A reply belongs to the main speech before it."""
    rows = duckdb.sql(f"""
        select path, "first", speech_number, is_reply, party, speaker, session, kind,
               coalesce(excerpt, '')
        from read_parquet('{SOURCE}', hive_partitioning = false)
        where session >= '{FIRST_MARKED}'
          and (path, "first") in (select path, "first" from read_parquet('{SOURCE}',
                                  hive_partitioning = false) where is_reply)
        order by path, "first", speech_number
    """).fetchall()
    return label(rows)


def label(rows) -> list[dict]:
    """Rows in protocol order. A reply belongs to the main speech before it in the same debate."""
    speeches, current, debate, position = [], None, None, 0
    for path, first, _, is_reply, party, speaker, session, kind, excerpt in rows:
        key = f"{path}#{first}"
        if key != debate:
            debate, current, position = key, None, 0
        if is_reply:
            if current is not None:
                current["label"] = 1
            continue
        position += 1
        current = {"debate": key, "position": min(position, MAX_POSITION),
                   "party": party or "none", "speaker": data._normalise_speaker(speaker or ""),
                   "session": session, "kind": kind, "text": OPENING.sub("", excerpt), "label": 0}
        speeches.append(current)
    return speeches


def fit(speeches, train, test, text: bool) -> np.ndarray:
    meta = np.array([[s["party"], str(s["position"]), s["kind"]] for s in speeches])
    onehot = OneHotEncoder(handle_unknown="ignore")
    parts_train, parts_test = [onehot.fit_transform(meta[train])], [onehot.transform(meta[test])]
    if text:
        texts = np.array([s["text"] for s in speeches], dtype=object)
        words = TfidfVectorizer(ngram_range=(1, 2), min_df=5, max_features=200000,
                                sublinear_tf=True)
        parts_train.append(words.fit_transform(texts[train]))
        parts_test.append(words.transform(texts[test]))
    targets = np.array([s["label"] for s in speeches])
    model = LogisticRegression(max_iter=3000, C=1.0)
    model.fit(hstack(parts_train).tocsr(), targets[train])
    return model.predict_proba(hstack(parts_test).tocsr())[:, 1]


def run(job_dir: Path, device: str, cached: dict, force: bool, transformers: bool = True) -> dict:
    speeches = load()
    targets = np.array([s["label"] for s in speeches])
    debates = np.array([s["debate"] for s in speeches])
    speakers = np.array([s["speaker"] for s in speeches])
    sessions = np.array([s["session"] for s in speeches])
    inputs = {"speeches": len(speeches), "replied": int(targets.sum()),
              "max_position": MAX_POSITION, "latest": LATEST, "first_marked": FIRST_MARKED,
              "scope": "debates with a reply", "source": "speech_cards excerpt"}
    key = hashlib.sha256(json.dumps(inputs, sort_keys=True).encode()).hexdigest()[:16]
    if not force and key in cached:
        print(f"  cached, skipping ({cached[key].parent.name})", flush=True)
        return {**json.loads(cached[key].read_text(encoding="utf-8")), "status": "cached"}
    print(f"  {len(speeches):,} main speeches, {targets.mean():.1%} drew a reply, "
          f"{len(set(debates.tolist())):,} debates", flush=True)

    split = splits.grouped_split(debates, test_size=0.25, seed=0)
    splits.assert_no_group_leak(debates, split)
    truth, groups = targets[split.test], debates[split.test]
    with_text = fit(speeches, split.train, split.test, text=True)
    meta_only = fit(speeches, split.train, split.test, text=False)
    headline = metrics.cluster_bootstrap(metrics.auc, truth, with_text, groups)
    baseline = metrics.cluster_bootstrap(metrics.auc, truth, meta_only, groups)
    gain = metrics.paired_cluster_bootstrap(metrics.auc, truth, with_text, meta_only, groups)
    null = metrics.permutation_test(metrics.auc, truth, with_text, iterations=200)

    by_speaker = splits.grouped_split(speakers, test_size=0.25, seed=0)
    splits.assert_no_group_leak(speakers, by_speaker)
    speaker_gain = metrics.paired_cluster_bootstrap(
        metrics.auc, targets[by_speaker.test],
        fit(speeches, by_speaker.train, by_speaker.test, text=True),
        fit(speeches, by_speaker.train, by_speaker.test, text=False), speakers[by_speaker.test])

    latest = np.isin(sessions, LATEST)
    later = splits.Split(np.where(~latest)[0], np.where(latest)[0], "temporal", "session")
    later_gain = metrics.paired_cluster_bootstrap(
        metrics.auc, targets[later.test], fit(speeches, later.train, later.test, text=True),
        fit(speeches, later.train, later.test, text=False), debates[later.test])

    rates = {}
    for position in range(1, MAX_POSITION + 1):
        rows = np.array([s["position"] == position for s in speeches])
        rates[str(position)] = round(float(targets[rows].mean()), 3) if rows.any() else None
    (job_dir / "detail.json").write_text(json.dumps({
        "reply_rate_by_position": rates, "permutation": null,
        "speaker_split_gain": speaker_gain, "later_sessions_gain": later_gain,
    }, ensure_ascii=False, indent=1), encoding="utf-8")

    passed = bool(gain["low"] is not None and gain["low"] > 0.01)
    rule = ("Text and metadata against metadata alone on held-out debates: lower bound of the "
            "paired bootstrap AUC difference above 0.01. Declared before the first run.")
    detail = (f"AUC {headline['point']:.3f} with text against {baseline['point']:.3f} without; "
              f"difference {gain['point']:+.3f} ({gain['low']:+.3f} to {gain['high']:+.3f}).")
    row = lambda name, metric, s: {"name": name, "metric": metric, "value": s["point"],
                                   "low": s["low"], "high": s["high"]}
    card_headline = row("Opening text + party + position, TF-IDF LR", "AUC", headline)
    return {
        "key": key, "inputs": inputs, "headline": card_headline,
        "best_baseline": row("Party + position + debate kind", "AUC", baseline),
        "gate": {"rule": rule, "passed": passed, "detail": detail},
        "card": {
            "purpose": "Which Riksdag speeches draw a reply, read from their opening lines",
            "label_meaning":
                "A main speech is labelled 1 when the protocol has at least one reply between "
                "it and the next main speech. Replies are a right any member can use, so the "
                "label records that someone chose to answer, not that the speech was wrong or "
                "provocative.",
            "data": {
                "main speeches": f"{len(speeches):,}",
                "share drawing a reply": f"{targets.mean():.1%}",
                "debates": f"{len(set(debates.tolist())):,}",
                "sessions": f"{min(sessions.tolist())} to {max(sessions.tolist())}",
                "reply rate, first and fifth speech": f"{rates['1']:.0%} and {rates['5']:.0%}",
                "permutation p-value (200 shuffles)": f"{null['p_value']:.3f}",
                "source": "Riksdag protocols, speech cards as served under parquet/.",
            },
            "split":
                "Whole debates held out, 25% of speeches; intervals bootstrap debates. Checked "
                "again with whole speakers held out and with the last four sessions held out.",
            "baselines": [row("Party + position + debate kind", "AUC", baseline)],
            "also": [row("Text minus metadata", "AUC difference", gain),
                     row("Text minus metadata, speakers held out", "AUC difference",
                         speaker_gain),
                     row("Text minus metadata, last four sessions held out", "AUC difference",
                         later_gain)],
            "headline": card_headline,
            "gate": {"rule": rule, "passed": passed, "detail": detail},
            "limitations": [
                f"Only debates from {FIRST_MARKED} with at least one reply. Earlier protocols "
                "do not mark replies, and a first run that included them and reply-free formats "
                "scored AUC 0.88 by recognising era and format. It was discarded.",
                "Only the opening of each speech is used, about 260 characters. What draws a "
                "reply may come later in the speech.",
                "A reply is attributed to the main speech before it. A member can reply to an "
                "earlier speaker, so some labels belong to another speech.",
                "Speakers are matched on the name in the protocol. The same person can appear "
                "under different titles, so the speaker split may leak a few people.",
                "Debate kind and party describe the setting, not intent. The model says which "
                "openings are followed by replies, not why.",
            ],
        },
    }
