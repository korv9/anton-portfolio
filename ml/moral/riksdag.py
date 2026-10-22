"""Part A, Swedish: the Riksdag passage sample, the blind review sheet, the stop rule and the shares.

    python -m ml.moral.riksdag sample          # stream every session archive, then RUN/sample.parquet
    python -m ml.moral.riksdag review          # tmp/mf-review.csv (+ instructions) for the owner
    python -m ml.moral.riksdag gate --labels tmp/mf-review.csv   # Swedish F1 against English: gate.json
    python -m ml.moral.riksdag score           # only after the gate passed: shares.parquet, spread.parquet

Unit, sample, review draw, threshold and null are fixed in docs/philosophy-moral-preregistration.md.
The candidates stay in ignored local storage; RUN/sample.parquet holds passage text and is never
published. score is the step meant for cluster-jobs.yml (module ml.moral.riksdag score, path
philosophy/moral); it needs the whole sample embedded, which `score` asks Workers AI for first.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import tempfile
from pathlib import Path

import numpy as np
import pandas as pd

from ml.moral import FEATURES, FOUNDATIONS, REPO, embed
from ml.moral.stats import bootstrap, f1, holm, party_null, rank

sys.path.insert(0, str(REPO / "platform/nlp/text"))
from concepts import paragraphs  # noqa: E402  (Riksdagen's HTML to plain text, as futures_language)

LOCAL = REPO / "warehouse/ml/moral/candidates"
RUN = FEATURES / "run"
REVIEW = REPO / "tmp/mf-review.csv"
YEARS, PER_YEAR, REVIEW_SIZE, MIN_CELL, MIN_POSITIVES, RATIO = (1993, 2026), 1500, 300, 50, 10, 0.8
# Party cells: the Riksdag parties; KDS is KD before its 1996 name. Speaker titles count only in the year.
PARTIES = {"S", "M", "L", "V", "C", "MP", "KD", "SD", "NYD", "KDS"}
WORD = re.compile(r"\w+")
SENTENCE = re.compile(r"(?<=[.!?])\s+")
# A word hyphenated at a hard line end in the 1990s print layout: "perio-\nden".
BROKEN = re.compile(r"(\w)-\r?\n(?=[a-zåäö])")
PACK = 80
DEFINITIONS = {
    "care": "caring for or protecting others, kindness, compassion; or harm, cruelty, suffering",
    "equality": "equal treatment, equal rights or equal outcomes; or inequality, discrimination",
    "proportionality": "people getting what they deserve in proportion to merit, effort or wrongdoing; "
                       "reward, punishment, cheating",
    "loyalty": "loyalty to a group, nation or family, solidarity, patriotism; or betrayal",
    "authority": "respect for tradition, hierarchy, legitimate authority, law and order; or subversion",
    "purity": "sanctity, purity, avoiding degradation or disgust, religious or bodily purity; or contamination",
}


def passages(raw: str) -> list[str]:
    """Consecutive sentences packed up to 80 words; kept at 15 to 150 words. Markup differs by era (HTML
    paragraphs, one CRLF per paragraph, hard-wrapped print lines), so the unit ignores it: tags are
    stripped, words broken at a line end are joined, and all white space becomes one space."""
    text = " ".join(paragraphs(BROKEN.sub(r"\1", raw)))
    out, current = [], []
    for sentence in SENTENCE.split(text):
        if current and len(WORD.findall(" ".join([*current, sentence]))) > PACK:
            out.append(" ".join(current))
            current = []
        current.append(sentence)
    if current:
        out.append(" ".join(current))
    return [p for p in out if 15 <= len(WORD.findall(p)) <= 150]


def passage(speech_id: str, raw: str) -> tuple[int, str] | None:
    """The eligible passage with the lowest hash, or None."""
    return min(enumerate(passages(raw)), key=lambda f: rank(speech_id, f[0]), default=None)


def speeches(path: Path):
    """Speeches of a session archive as futures_language.speeches reads them, with the raw markup."""
    import zipfile
    from futures_language import PARTY
    with zipfile.ZipFile(path) as z:
        for name in z.namelist():
            if name.endswith(".json"):
                s = json.loads(z.read(name).decode("utf-8-sig"))["anforande"]
                party = (s.get("parti") or "").strip()
                yield {"id": f"{s['dok_id']}-{s['anforande_nummer']}", "date": (s.get("dok_datum") or "")[:10],
                       "party": PARTY.get(party, party.upper() or None), "raw": s.get("anforandetext") or ""}


def candidates() -> None:
    sys.path.insert(0, str(REPO / "platform/ingest/riksdagen"))
    from futures_language import http_session, sessions
    http = http_session()
    LOCAL.mkdir(parents=True, exist_ok=True)
    for code, url in sessions(http).items():
        target = LOCAL / f"{code}.parquet"
        if target.exists():
            continue
        rows, seen = [], set()
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / f"{code}.zip"
            with http.get(url, stream=True, timeout=(30, 300)) as response, path.open("wb") as out:
                response.raise_for_status()
                for chunk in response.iter_content(1 << 20):
                    out.write(chunk)
            for s in speeches(path):
                if s["id"] in seen or not s["date"][:4].isdigit():
                    continue
                seen.add(s["id"])
                if hit := passage(s["id"], s["raw"]):
                    rows.append({"speech_id": s["id"], "date": s["date"], "year": int(s["date"][:4]),
                                 "party": s["party"], "passage_index": hit[0], "text": hit[1]})
        pd.DataFrame(rows).to_parquet(target.with_suffix(".tmp"), index=False)
        target.with_suffix(".tmp").replace(target)
        print(f"{code}: {len(seen):,} speeches, {len(rows):,} with an eligible passage", flush=True)


def sample() -> pd.DataFrame:
    candidates()
    frame = pd.concat([pd.read_parquet(p) for p in sorted(LOCAL.glob("*.parquet"))], ignore_index=True)
    frame = frame.drop_duplicates("speech_id")
    frame = frame[frame.year.between(*YEARS)].copy()
    frame["order"] = [rank(i) for i in frame.speech_id]
    frame = frame.sort_values("order").groupby("year", group_keys=False).head(PER_YEAR)
    frame["passage_id"] = [hashlib.sha1(f"{s}:{i}".encode()).hexdigest()[:16]
                             for s, i in zip(frame.speech_id, frame.passage_index)]
    frame = frame.sort_values(["year", "order"])[
        ["passage_id", "speech_id", "date", "year", "party", "passage_index", "text"]].reset_index(drop=True)
    RUN.mkdir(parents=True, exist_ok=True)
    frame.to_parquet(RUN / "sample.parquet", index=False)
    print(frame.groupby("year").agg(passages=("passage_id", "size"), first=("date", "min"),
                                    last=("date", "max")).to_string())
    return frame


def review_set(frame: pd.DataFrame) -> pd.DataFrame:
    frame = frame.assign(order=[rank("review", p) for p in frame.passage_id])
    return frame.nsmallest(REVIEW_SIZE, "order").sort_values("order")


EMPTY = {"shares": {"foundation": "str", "year": "int64", "party": "str", "passages": "int64", "share": "float64",
                    "ci_low": "float64", "ci_high": "float64", "null_low": "float64", "null_high": "float64"},
         "spread": {"foundation": "str", "spread": "float64", "null_spread_p95": "float64", "null_p": "float64",
                    "null_rounds": "int64", "holm_p": "float64"}}


def pending() -> None:
    """Until the owner's labels exist: the gate says so and the Riksdag tables are empty."""
    FEATURES.mkdir(parents=True, exist_ok=True)
    gate = {"status": "awaiting labels", "passages": None, "raters": None, "swedish_macro_f1": None,
            "english_macro_f1": None, "ratio_required": RATIO, "passed": None, "foundations": []}
    (FEATURES / "gate.json").write_text(json.dumps(gate, indent=1), encoding="utf-8")
    for name, columns in EMPTY.items():
        pd.DataFrame({c: pd.Series(dtype=t) for c, t in columns.items()}).to_parquet(
            FEATURES / f"{name}.parquet", index=False)


def review() -> None:
    picked = review_set(pd.read_parquet(RUN / "sample.parquet"))
    REVIEW.parent.mkdir(parents=True, exist_ok=True)
    pd.DataFrame({"passage_id": picked.passage_id, "text": picked.text,
                  **{f: "" for f in FOUNDATIONS}}).to_csv(REVIEW, index=False, encoding="utf-8")
    REVIEW.with_name("mf-review-instructions.md").write_text(
        "# Labelling tmp/mf-review.csv\n\nFor each passage write 1 in a foundation's column when the passage "
        "appeals to it, explicitly or clearly implied, and 0 otherwise. A passage can have several or none. "
        "Do not look up the speaker, party or date. Definitions, after MFRC (Trager et al.):\n\n"
        + "".join(f"- {f}: {d}\n" for f, d in DEFINITIONS.items()), encoding="utf-8")
    print(f"{len(picked)} passages -> {REVIEW.relative_to(REPO)}")
    # Pre-registered: the review set is embedded at once, the full sample only after the gate.
    embed(picked.passage_id.tolist(), picked.text.tolist(), "riksdag-review", "moral-review")
    if not (FEATURES / "gate.json").exists():
        pending()


def tagger() -> tuple[np.ndarray, np.ndarray, np.ndarray, list[str]]:
    model = np.load(FEATURES / "tagger.npz")
    labels = list(model["labels"])
    keep = [labels.index(f) for f in FOUNDATIONS]
    return model["coef"][keep], model["intercept"][keep], model["threshold"][keep], FOUNDATIONS


def flags(vectors: np.ndarray) -> np.ndarray:
    coef, intercept, threshold, _ = tagger()
    return 1 / (1 + np.exp(-(vectors @ coef.T + intercept))) >= threshold


def gate(labels_path: Path) -> dict:
    labelled = pd.read_csv(labels_path, dtype={"passage_id": str})
    picked = review_set(pd.read_parquet(RUN / "sample.parquet")).set_index("passage_id")
    labelled = labelled.set_index("passage_id").loc[picked.index]
    if labelled[FOUNDATIONS].isna().any().any():
        raise SystemExit("Every review passage needs a 0 or 1 in each foundation column.")
    truth = labelled[FOUNDATIONS].astype(int).astype(bool)
    vectors = embed(list(picked.index), picked.text.tolist(), "riksdag-review", "moral-review")
    if vectors is None:
        raise SystemExit("Review passages are not all embedded yet; run again after the quota resets.")
    predicted = flags(vectors)
    english = pd.read_parquet(FEATURES / "agreement.parquet").set_index("foundation").tagger_f1
    rows = [{"foundation": f, "positives": int(truth[f].sum()), "swedish_f1": f1(truth[f], predicted[:, i]),
             "english_f1": float(english[f])} for i, f in enumerate(FOUNDATIONS)]
    for r in rows:
        r["validated"] = bool(r["positives"] >= MIN_POSITIVES and r["swedish_f1"] is not None
                              and r["swedish_f1"] >= RATIO * r["english_f1"])
    swedish = float(np.mean([r["swedish_f1"] or 0 for r in rows]))
    passed = swedish >= RATIO * float(english[FOUNDATIONS].mean())
    result = {"status": "passed" if passed else "failed", "passages": len(truth), "raters": 1, "swedish_macro_f1": swedish,
              "english_macro_f1": float(english[FOUNDATIONS].mean()), "ratio_required": RATIO,
              "passed": passed, "foundations": rows}
    # The owner's labels are kept without the text, so the gate can be recomputed.
    truth.astype(int).reset_index().to_parquet(FEATURES / "review_labels.parquet", index=False)
    (FEATURES / "gate.json").write_text(json.dumps(result, indent=1), encoding="utf-8")
    return result


def shares(frame: pd.DataFrame, flagged: np.ndarray) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Year and year x party shares with bootstrap intervals, and the within-year party shuffle null."""
    cells, spread = [], []
    has_party = frame.party.notna().to_numpy()
    for i, f in enumerate(FOUNDATIONS):
        values = flagged[:, i].astype(float)
        for year, idx in frame.groupby("year").indices.items():
            cells.append({"foundation": f, "year": int(year), "party": None, "passages": len(idx),
                          "share": values[idx].mean(), "ci": bootstrap(values[idx], np.mean)})
        sub = frame[has_party]
        big = sub.groupby(["year", "party"]).passage_id.transform("size") >= MIN_CELL
        sub, sub_values = sub[big.to_numpy()], values[has_party][big.to_numpy()]
        null = party_null(sub_values, sub.year.to_numpy(), sub.party.to_numpy())
        for (year, party), idx in sub.groupby(["year", "party"]).indices.items():
            cells.append({"foundation": f, "year": int(year), "party": party, "passages": len(idx),
                          "share": sub_values[idx].mean(), "ci": bootstrap(sub_values[idx], np.mean),
                          "null_band": null["cells"][(year, party)]})
        spread.append({"foundation": f, "spread": null["spread"], "null_spread_p95": null["spread_p95"],
                       "null_p": null["p"], "null_rounds": null["rounds"]})
    cells = pd.DataFrame(cells)
    cells[["ci_low", "ci_high"]] = pd.DataFrame(cells.pop("ci").tolist(), index=cells.index)
    band = cells.pop("null_band").apply(lambda b: b if isinstance(b, tuple) else (None, None))
    cells[["null_low", "null_high"]] = pd.DataFrame(band.tolist(), index=cells.index)
    spread = pd.DataFrame(spread)
    spread["holm_p"] = holm(spread.null_p.tolist())
    return cells, spread


def score() -> None:
    result = json.loads((FEATURES / "gate.json").read_text(encoding="utf-8")) if (FEATURES / "gate.json").exists() else {}
    if not result.get("passed"):
        raise SystemExit("The Swedish check has not passed; nothing about the Riksdag is scored.")
    frame = pd.read_parquet(RUN / "sample.parquet")
    frame["party"] = frame.party.where(frame.party.isin(PARTIES)).replace({"KDS": "KD"})
    vectors = embed(frame.passage_id.tolist(), frame.text.tolist(), "riksdag", "moral-riksdag")
    if vectors is None:
        raise SystemExit(3)
    cells, spread = shares(frame, flags(vectors))
    validated = {r["foundation"] for r in result["foundations"] if r["validated"]}
    spread = spread[spread.foundation.isin(validated)].copy()
    spread["holm_p"] = holm(spread.null_p.tolist())
    cells[cells.foundation.isin(validated)].to_parquet(FEATURES / "shares.parquet", index=False)
    spread.to_parquet(FEATURES / "spread.parquet", index=False)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("step", choices=["sample", "review", "gate", "score"])
    parser.add_argument("--labels", type=Path, default=REVIEW)
    args = parser.parse_args()
    if args.step == "sample":
        sample()
    elif args.step == "review":
        review()
    elif args.step == "gate":
        print(json.dumps(gate(args.labels), indent=1))
    else:
        score()


if __name__ == "__main__":
    main()
