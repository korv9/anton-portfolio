"""Old Bailey extraction baselines: majority class and keyword rules.

    python -m ml.oldbailey.rules [--split dev]

The rules are ordered regular expressions per category, written from the category definitions
(docs/oldbailey-extraction-preregistration.md) and checked on the development split only. An
unmatched trial gets the majority class, taken from the trials outside the sample and dev split.
Prints accuracy per field on the chosen split.
"""
from __future__ import annotations

import argparse
import re

import pandas as pd

from ml.oldbailey.trials import OUT

FIELDS = ("offence", "verdict", "punishment")

# Offence: the first match in the indictment (the opening words), most specific category first.
OFFENCE = [
    ("kill", r"murd[eu]?r|manslaughter|killing|slaying|kill(ed)? and slay|infant"),
    ("sexual", r"\brape|ravish|bigamy|sodom|unnatural|carnal|indecent|intent to commit|brothel|disorderly house|feloniously marrying"),
    ("royalOffences", r"\bcoin(ing|er|ed)?\b|counterfeit|clipping|treason|seditious|false money|base money"),
    ("deception", r"forg|false pretence|fraud|perjur|bankrupt|false oath|personat|obtaining"),
    ("violentTheft", r"robb|highway|putting (him|her|them) in fear|on the king's highway|with violence"),
    ("damage", r"\bset(ting)? fire|arson|burn(ing|t)? .{0,40}house|maliciously damag"),
    ("breakingPeace", r"assault|wound|stab|cut(ting)? and wound|riot|libel|shoot|threat|grievous bodily"),
    ("miscellaneous", r"returning from transportation|being found at large|conceal(ing)? the birth|conspir|kidnap|escape|perverting"),
    ("theft", r"steal|stole|larceny|burglar|feloniously taking|pick|embezzl|receiv"),
]
VERDICT = [
    ("notGuilty", r"not guilty|acquitted|\bacq\b|discharged|no evidence|no prosecutor"),
    ("specialVerdict", r"special verdict|insane|lunatic|non compos"),
    ("guilty", r"(?<!not )guilty|convicted|confessed"),
]
# The first match in the closing words. Eighteenth-century reports abbreviate the sentence after
# the verdict ("Guilty. T." or "W."); the project files penal servitude under imprison.
PUNISHMENT = [
    ("death", r"\bdeath\b|to be hanged|\bd\s*\.\s*$"),
    ("transport", r"transport|\bt\s*\.|\bt\.\s"),
    ("corporal", r"whipp|pillory|\bw\s*\.\s*$"),
    ("imprison", r"imprison|confine|penal servitude|house of correction|hard labour|newgate|\b\w+ (days|weeks|months|years?)\b"),
    ("miscPunish", r"brand|burnt in the hand|fined|fine of|sureties|military|navy|army|sent to sea|bail|\bb\s*\.\s*$"),
    ("noPunish", r"respited|pardon|discharged|recogni[sz]ance"),
]
OFFENCE_RE = [(c, re.compile(p, re.I)) for c, p in OFFENCE]
VERDICT_RE = [(c, re.compile(p, re.I)) for c, p in VERDICT]
PUNISHMENT_RE = [(c, re.compile(p, re.I)) for c, p in PUNISHMENT]


def first(text: str, rules) -> str | None:
    return next((c for c, pattern in rules if pattern.search(text)), None)


def last(text: str, rules) -> str | None:
    """The category whose pattern matches latest in the text; ties go to the earlier rule."""
    best, where = None, -1
    for category, pattern in rules:
        hits = [m.start() for m in pattern.finditer(text)]
        if hits and hits[-1] > where:
            best, where = category, hits[-1]
    return best


def keyword(text: str, majority: dict[str, str]) -> dict[str, str]:
    words = text.split()
    opening, ending = " ".join(words[:80]), " ".join(words[-60:])
    verdict = last(ending, VERDICT_RE) or majority["verdict"]
    if verdict == "notGuilty":
        punishment = "none"
    else:
        punishment = first(" ".join(words[-25:]), PUNISHMENT_RE) or majority["punishment"]
    return {"offence": first(opening, OFFENCE_RE) or majority["offence"],
            "verdict": verdict, "punishment": punishment}


def majority_classes(trials: pd.DataFrame) -> dict[str, str]:
    rest = trials[trials["split"] == "rest"]
    return {field: rest[field].dropna().value_counts().idxmax() for field in FIELDS}


def predict(trials: pd.DataFrame) -> pd.DataFrame:
    """Majority and keyword predictions for the sample and dev rows: trial_id, method, fields."""
    majority = majority_classes(trials)
    rows = []
    for row in trials[trials["split"] != "rest"].itertuples():
        rows.append({"trial_id": row.trial_id, "method": "majority", **majority})
        rows.append({"trial_id": row.trial_id, "method": "keyword", **keyword(row.text, majority)})
    return pd.DataFrame(rows)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--split", default="dev", choices=["dev", "sample"])
    args = parser.parse_args()
    trials = pd.read_parquet(OUT / "trials.parquet")
    gold = trials[trials["split"] == args.split].set_index("trial_id")
    predicted = predict(trials)
    for method, part in predicted.groupby("method"):
        part = part.set_index("trial_id").loc[gold.index]
        print(method, {f: round(float((part[f] == gold[f])[gold[f].notna()].mean()), 3) for f in FIELDS})


if __name__ == "__main__":
    main()
