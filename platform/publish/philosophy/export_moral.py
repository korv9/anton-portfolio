"""Publish philosophy track 1: the moral-foundation tagger's agreement and gemma's ETHICS agreement.

    python platform/publish/philosophy/export_moral.py

Reads the gold marts of models/gold/philosophy_moral and writes two files under
frontend/public/data/philosophy/moral/:

  foundations.json        English agreement per foundation beside the human ceiling and eMFD; the
                          Swedish check; Riksdag shares and the party shuffle null only when the
                          check has passed, and then only for validated foundations.
  ethics.json             per ETHICS subset and wording: accuracy, kappa, the majority baseline and
                          the label-shuffle null.

Everything is fixed in docs/philosophy-moral-preregistration.md. No text is published. An export
without its null refuses to write (check_nulls).
"""
from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parents[3]
DATABASE = Path(os.environ.get("PORTFOLIO_DB", ROOT / "warehouse/portfolio.duckdb"))
OUT = ROOT / "frontend/public/data/philosophy/moral"
PREREGISTRATION = "docs/philosophy-moral-preregistration.md"
SOURCES = [
    {"name": "Moral Foundations Reddit Corpus (MFRC)", "url": "https://huggingface.co/datasets/USC-MOLA-Lab/MFRC",
     "revision": "ddc21d2f03e156732fd1ba95a51c4c29f07975be", "licence": "CC BY 4.0", "checked": "2026-10-22"},
    {"name": "Extended Moral Foundations Dictionary (eMFD)", "url": "https://osf.io/vw85e",
     "licence": "GPL-3.0", "checked": "2026-10-22", "use": "English baseline; not redistributed"},
    {"name": "Riksdag speeches", "url": "https://data.riksdagen.se/", "licence": "Riksdagen open data"},
]
ETHICS_SOURCE = {"name": "ETHICS (Hendrycks et al. 2021)", "url": "https://huggingface.co/datasets/hendrycks/ethics",
                 "revision": "b8b47c589f8bee77175b8648e5497278b68da48a", "licence": "MIT", "checked": "2026-10-22"}
DEPARTURES = [
    "2026-10-22: the Riksdag unit is a passage of consecutive sentences packed up to 80 words instead of a "
    "paragraph, because the archives mark paragraphs differently by era (HTML, one line break, hard-wrapped "
    "print lines) and the registered split left only short speeches eligible in 1996/97-2013/14. Amended "
    "before any Riksdag text was embedded or labelled.",
    "2026-10-22: the threshold grid 0.05-0.95 is coarse for eMFD, whose mean word probabilities lie near "
    "0.1; the baseline kept the pre-registered grid, so its F1 may be lower than a finer grid would give.",
    "2026-10-22: the first 101 ETHICS answers came from a serial run, the rest from four parallel calls; "
    "temperature is 0 and the prompts are the same, so the answers do not depend on the order.",
]


def rows(con, sql: str) -> list[dict]:
    cursor = con.execute(sql)
    names = [d[0] for d in cursor.description]
    return [{k: (round(v, 4) if isinstance(v, float) else v) for k, v in zip(names, r)} for r in cursor.fetchall()]


def check_nulls(moral: dict, ethics: dict) -> None:
    """The nulls are part of the result; a payload without them is not published."""
    for r in ethics["subsets"]:
        if r.get("null_kappa_p95") is None or r.get("null_p") is None:
            raise ValueError(f"ETHICS {r.get('subset')} wording {r.get('wording')} has no label-shuffle null")
    riksdag = moral["riksdag"]
    if riksdag is not None and (not riksdag["spread"] or any(r.get("null_p") is None for r in riksdag["spread"])):
        raise ValueError("Riksdag shares without the party shuffle null")


def moral_payload(con) -> dict:
    english = rows(con, "select * from gold.mart_moral_foundation_agreement order by foundation = 'fairness', foundation")
    check = rows(con, "select * from gold.mart_moral_swedish_check")
    status = check[0]["status"] if check else "awaiting labels"
    passed = status == "passed"
    six = [r for r in english if not r["merged"]]
    riksdag = None
    if passed:
        riksdag = {"shares": rows(con, "select * from gold.mart_moral_foundation_shares order by foundation, year, party nulls first"),
                   "spread": rows(con, "select * from gold.mart_moral_party_spread order by foundation")}
    return {
        "status": status,
        "english": english,
        "swedish_check": {k: check[0][k] for k in ("status", "passages", "raters", "swedish_macro_f1",
                                                     "english_macro_f1", "ratio_required", "passed")} | {
            "foundations": [{k: r[k] for k in ("foundation", "positives", "swedish_f1", "english_f1", "validated")}
                            for r in check if r["foundation"]]} if check else {"status": status},
        "riksdag": riksdag,
        "diagnostics": {
            "english_macro_f1": round(sum(r["tagger_f1"] for r in six) / len(six), 4),
            "human_pair_macro_f1": round(sum(r["human_pair_f1"] for r in six) / len(six), 4),
            "tagger_vs_annotator_macro_f1": round(sum(r["tagger_vs_annotator_f1"] for r in six) / len(six), 4),
            "test_comments": six[0]["test_comments"],
            "party_null_rounds": riksdag["spread"][0]["null_rounds"] if riksdag else None,
        },
        "method": {
            "preregistration": PREREGISTRATION,
            "tagger": "bge-m3 vectors (Workers AI) and one logistic regression per foundation, trained on 80 % of "
                      "MFRC comments; gold label = more than half of a comment's annotators.",
            "ceiling": "Mean F1 of one annotator against another on test comments with three or more annotators; "
                       "the tagger's comparable figure is its mean F1 against each single annotator.",
            "baseline": "eMFD: mean dictionary probability of a comment's words, threshold chosen on the train split; "
                        "English only, fairness compared with equality or proportionality merged.",
            "swedish_check": "300 Riksdag passages labelled blind by the owner; Riksdag shares are published only "
                             "if the Swedish macro-F1 is at least 0.8 times the English one.",
            "null": "Party labels shuffled within year, 999 rounds; between-party spread and a band per party cell.",
            "sources": SOURCES, "departures": DEPARTURES[:2],
        },
        "caveat_en": "The tagger flags vocabulary that crowdworkers linked to a moral foundation in English Reddit "
                     "comments. A share is how often that vocabulary appears, not how moral a party or a speech is.",
        "caveat_sv": "Klassaren markerar ordförråd som annoterare kopplade till en moralisk grund i engelska "
                     "Reddit-kommentarer. En andel visar hur ofta det ordförrådet förekommer, inte hur moraliskt "
                     "ett parti eller ett anförande är.",
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }


def ethics_payload(con) -> dict:
    subsets = rows(con, "select * from gold.mart_ethics_agreement order by subset, wording")
    return {
        "subsets": subsets,
        "diagnostics": {"items_per_subset": subsets[0]["items"], "null_rounds": subsets[0]["null_rounds"],
                        "unparsed": sum(r["unparsed"] for r in subsets),
                        "subsets_beating_null_in_both_wordings": sorted(
                            {r["subset"] for r in subsets if r["beats_null_both_wordings"]})},
        "method": {
            "preregistration": PREREGISTRATION,
            "model": "@cf/google/gemma-4-26b-a4b-it on Workers AI, thinking off, temperature 0, two fixed wordings "
                     "(ml/moral/ethics.py).",
            "sample": "200 rows of each subset's test split by a seeded hash; commonsense short items only.",
            "baseline": "Always the most common label among the 200 (kappa 0).",
            "null": "Human labels permuted 999 times; the 95th percentile of kappa and a one-sided p.",
            "sources": [ETHICS_SOURCE], "departures": DEPARTURES[2:],
        },
        "caveat_en": "Agreement with US crowdworkers' labels, on a public benchmark the model may have seen. The "
                     "subsets differ in format, so they are not ranked, and nothing here says which theory is right.",
        "caveat_sv": "Överensstämmelse med amerikanska crowdworkers etiketter, på ett offentligt test som modellen "
                     "kan ha sett. Delarna har olika format och rangordnas därför inte, och inget här säger vilken "
                     "teori som stämmer.",
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }


def main() -> int:
    con = duckdb.connect(str(DATABASE), read_only=True)
    con.execute("set memory_limit = '1GB'")
    moral, ethics = moral_payload(con), ethics_payload(con)
    check_nulls(moral, ethics)
    paths = []
    OUT.mkdir(parents=True, exist_ok=True)
    for name, payload in (("foundations.json", moral), ("ethics.json", ethics)):
        path = OUT / name
        path.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
        paths.append(path)
    sys.path.insert(0, str(ROOT / "platform/publish/symbolic"))
    import export_symbolic

    export_symbolic.register(paths)
    print(f"Moral foundations: {moral['status']}; ETHICS: {len(ethics['subsets'])} rows -> "
          + ", ".join(str(p.relative_to(ROOT)) for p in paths))
    return 0


if __name__ == "__main__":
    sys.exit(main())
