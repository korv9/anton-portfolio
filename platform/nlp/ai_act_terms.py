"""Find the AI Act's own vocabulary: n-grams of the Act's Swedish text that Swedish statute law lacks.

    python platform/nlp/ai_act_terms.py                 # candidates -> tmp/ai_act_terms_candidates.csv

Rule (docs/research/preregistrations/ai-act-diffusion-preregistration.md): one- to four-token
n-grams of the article texts in ai-act/article-text-sv, scored by weighted log-odds with an
informative Dirichlet prior (Monroe, Colaresi and Quinn 2008) against the SFS paragraphs; the prior
for each n-gram is its pooled count. Candidates occur at least 10 times in at least 3 articles and
neither start nor end with a stopword; those with z >= 3.29 are ranked and the top 60 go to review.
Each kept Swedish term gets the English n-gram of ai-act/article-text-en whose counts over the
articles are most alike (cosine). The reviewed list is
platform/seeds/cross_domain/ai_act_terms.csv: this output plus term_id, decision (keep or drop),
reason (for a drop), en_decision (keep or misaligned, for a kept term) and a note. The generic
scoring is platform/nlp/log_odds.py.
"""
from __future__ import annotations

import argparse
import csv
import json
import math
import os
import sys
from collections import Counter
from pathlib import Path

import duckdb

sys.path.insert(0, str(Path(__file__).resolve().parent))
import log_odds  # noqa: E402
from log_odds import STOP_EN, STOP_SV, article_counts, log_odds_z  # noqa: E402,F401  (callers read them here)

ROOT = Path(__file__).resolve().parents[2]
ACT = ROOT / "frontend/public/data/ai-act"
DATABASE = Path(os.environ.get("PORTFOLIO_DB", ROOT / "warehouse/portfolio.duckdb"))
SFS_SQL = "select text from silver.silver_sfs_corpus_paragraphs where text is not null"
OUT = ROOT / "tmp/ai_act_terms_candidates.csv"

MIN_COUNT, MIN_ARTICLES, Z_MIN, TOP = 10, 3, 3.29, 60


def score(per: dict, act_totals: Counter, reference, top: int = TOP) -> list[dict]:
    """Candidates against a reference corpus (an iterable of texts), ranked by z."""
    return [{"term_sv": r["term"], "act_count": r["count"], "act_articles": r["docs"],
             "sfs_count": r["reference_count"], "z": r["z"]}
            for r in log_odds.score(per, act_totals, reference, MIN_COUNT, MIN_ARTICLES, Z_MIN, top)]


def cosine(a: Counter, b: Counter) -> float:
    dot = sum(v * b.get(k, 0) for k, v in a.items())
    return dot / math.sqrt(sum(v * v for v in a.values()) * sum(v * v for v in b.values()))


def english_pairs(rows: list[dict], sv_per: dict, en_per: dict) -> None:
    en = {g: c for g, c in en_per.items() if sum(c.values()) >= MIN_COUNT and len(c) >= MIN_ARTICLES}
    for r in rows:
        profile = sv_per[tuple(r["term_sv"].split())]
        best = max(en, key=lambda g: (cosine(profile, en[g]), -len(g)))
        r["term_en"], r["en_cosine"] = " ".join(best), round(cosine(profile, en[best]), 3)


def sfs_texts():
    con = duckdb.connect(str(DATABASE), read_only=True)
    con.execute("set memory_limit = '1GB'")
    cursor = con.execute(SFS_SQL)
    while batch := cursor.fetchmany(5000):
        yield from (t for (t,) in batch)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--out", type=Path, default=OUT)
    args = parser.parse_args()
    sv = json.loads((ACT / "article-text-sv.json").read_text(encoding="utf-8"))
    en = json.loads((ACT / "article-text-en.json").read_text(encoding="utf-8"))
    sv_per, sv_totals = article_counts(sv, 4, STOP_SV)
    en_per, _ = article_counts(en, 5, STOP_EN)
    rows = score(sv_per, sv_totals, sfs_texts())
    english_pairs(rows, sv_per, en_per)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    with args.out.open("w", encoding="utf-8", newline="\n") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0]), lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)
    print(f"{len(rows)} candidates -> {args.out}")


if __name__ == "__main__":
    main()
