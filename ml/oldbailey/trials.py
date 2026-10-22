"""Old Bailey extraction: parse the Proceedings XML into eligible trials and draw the sample.

    python -m ml.oldbailey.trials

Unit, eligibility, gold labels, truncation and the draw are fixed in
docs/oldbailey-extraction-preregistration.md. Reads warehouse/raw/oldbailey/OBO_XML_7-2.zip one
session file at a time. Writes to OUT (warehouse/ml/oldbailey/, never pushed, since it holds
trial text):

    trials.parquet  every eligible trial: id, year, period, split, gold labels, words; the model
                    text only for the sample and development rows
    counts.json     trials read, left out and why, per period
"""
from __future__ import annotations

import json
import os
import random
import re
import xml.etree.ElementTree as ET
import zipfile
from collections import Counter
from pathlib import Path

import pandas as pd

REPO = Path(__file__).resolve().parents[2]
ZIP = Path(os.environ.get("PORTFOLIO_RAW", REPO / "warehouse/raw")) / "oldbailey/OBO_XML_7-2.zip"
OUT = Path(os.environ.get("OLDBAILEY_TEXT", REPO / "warehouse/ml/oldbailey"))
PERIODS = ((1674, 1749), (1750, 1799), (1800, 1849), (1850, 1913))
SAMPLE, SAMPLE_SEED = 500, 20261022
DEV, DEV_SEED = 50, 20261023
MAX_WORDS, KEEP = 1500, 750


def period(year: int) -> str:
    return next(f"{a}-{b}" for a, b in PERIODS if a <= year <= b)


def model_text(div: ET.Element) -> tuple[str, int]:
    """The trial's text with tags removed; over MAX_WORDS keeps both ends around [...]."""
    words = " ".join(div.itertext()).split()
    if len(words) > MAX_WORDS:
        return " ".join(words[:KEEP] + ["[...]"] + words[-KEEP:]), len(words)
    return " ".join(words), len(words)


def trial(div: ET.Element) -> tuple[dict | None, str]:
    """Gold labels of one trial account, or None and the reason it is left out."""
    interps: dict[str, dict[str, set]] = {}
    for node in div.iter("interp"):
        interps.setdefault(node.get("type"), {}).setdefault(node.get("inst"), set()).add(node.get("value"))
    charges = [j for j in div.iter("join") if j.get("result") == "criminalCharge"]
    defendants = [p for p in div.iter("persName") if p.get("type") == "defendantName"]
    offences = interps.get("offenceCategory", {})
    verdicts = interps.get("verdictCategory", {})
    if len(charges) != 1 or len(defendants) != 1:
        return None, "several_defendants_or_charges"
    if len(offences) != 1 or len(verdicts) != 1:
        return None, "several_offences_or_verdicts"
    (offence,), (verdict,) = offences.values(), verdicts.values()
    if len(offence) != 1 or len(verdict) != 1:
        return None, "conflicting_category"
    offence, verdict = next(iter(offence)), next(iter(verdict))
    punishments = set().union(*interps.get("punishmentCategory", {}).values())
    if len(punishments) == 1:
        punishment = next(iter(punishments))
    elif not punishments and verdict == "notGuilty":
        punishment = "none"
    else:
        # Several punishments, or a sentence printed outside the trial: not scored (pre-registered).
        punishment = None
    return {"offence": offence, "verdict": verdict, "punishment": punishment}, "eligible"


def sessions(path: Path):
    """Every trial account, session file by session file."""
    with zipfile.ZipFile(path) as archive:
        for name in sorted(n for n in archive.namelist() if re.fullmatch(r"sessionsPapers/\d{8}\.xml", n)):
            for div in ET.fromstring(archive.read(name)).iter("div1"):
                if div.get("type") == "trialAccount":
                    yield div


def parse(path: Path = ZIP) -> tuple[pd.DataFrame, list[dict]]:
    """Gold labels of the eligible trials, and each trial's period and reason, without text."""
    rows, reasons = [], []
    for div in sessions(path):
        year = int(div.get("id")[1:5])
        labels, reason = trial(div)
        reasons.append({"period": period(year), "reason": reason})
        if labels:
            rows.append({"trial_id": div.get("id"), "year": year, "period": period(year),
                         "words": len(" ".join(div.itertext()).split()), **labels})
    return pd.DataFrame(rows), reasons


def texts(ids: set[str], path: Path = ZIP) -> dict[str, str]:
    """The model text of the given trials; a second pass, so the full corpus is never held."""
    return {div.get("id"): model_text(div)[0] for div in sessions(path) if div.get("id") in ids}


def draw(frame: pd.DataFrame) -> pd.Series:
    """split per trial: sample (500 per period), dev (50 per period, outside the sample) or rest."""
    split = pd.Series("rest", index=frame.index)
    for name, size, seed in (("sample", SAMPLE, SAMPLE_SEED), ("dev", DEV, DEV_SEED)):
        for label in [f"{a}-{b}" for a, b in PERIODS]:
            pool = sorted(frame.index[(frame["period"] == label) & (split == "rest")],
                          key=lambda i: frame.at[i, "trial_id"])
            split[random.Random(seed).sample(pool, size)] = name
    return split


def main() -> None:
    frame, reasons = parse()
    frame["split"] = draw(frame)
    frame["text"] = frame["trial_id"].map(texts(set(frame.loc[frame["split"] != "rest", "trial_id"])))
    OUT.mkdir(parents=True, exist_ok=True)
    frame.to_parquet(OUT / "trials.parquet", index=False)
    counts = Counter((r["period"], r["reason"]) for r in reasons)
    summary = {"source": ZIP.name, "trials": len(reasons), "eligible": len(frame),
               "by_period": {p: {r: n for (q, r), n in sorted(counts.items()) if q == p}
                             for p in sorted({r["period"] for r in reasons})},
               "punishment_not_scored": {s: int(n) for s, n in
                                         frame[frame["punishment"].isna()]["split"].value_counts().items()}}
    (OUT / "counts.json").write_text(json.dumps(summary, indent=1) + "\n", encoding="utf-8")
    print(json.dumps(summary, indent=1))


if __name__ == "__main__":
    main()
