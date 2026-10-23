"""Find the AI Act's own vocabulary: n-grams of the Act's Swedish text that Swedish statute law lacks.

    python platform/nlp/ai_act_terms.py                 # candidates -> tmp/ai_act_terms_candidates.csv

Rule (docs/ai-act-diffusion-preregistration.md): one- to four-token n-grams of the article texts
in ai-act/article-text-sv, scored by weighted log-odds with an informative Dirichlet prior
(Monroe, Colaresi and Quinn 2008) against the SFS paragraphs; the prior for each n-gram is its
pooled count. Candidates occur at least 10 times in at least 3 articles and neither start nor end
with a stopword; those with z >= 3.29 are ranked and the top 60 go to review. Each kept Swedish
term gets the English n-gram of ai-act/article-text-en whose counts over the articles are most
alike (cosine). The reviewed list is platform/seeds/cross_domain/ai_act_terms.csv: this output
plus term_id, decision (keep or drop), reason (for a drop), en_decision (keep or misaligned, for
a kept term) and a note.
"""
from __future__ import annotations

import argparse
import csv
import json
import math
import os
import re
from collections import Counter, defaultdict
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parents[2]
ACT = ROOT / "frontend/public/data/ai-act"
DATABASE = Path(os.environ.get("PORTFOLIO_DB", ROOT / "warehouse/portfolio.duckdb"))
SFS_SQL = "select text from silver.silver_sfs_corpus_paragraphs where text is not null"
OUT = ROOT / "tmp/ai_act_terms_candidates.csv"

TOKEN = re.compile(r"[0-9a-zåäöéü]+(?:-[0-9a-zåäöéü]+)*")
MIN_COUNT, MIN_ARTICLES, Z_MIN, TOP = 10, 3, 3.29, 60
STOP_SV = set("""att av de dem den denna deras dess det detta dessa du där efter eller en ett för från
genom har hade han hon i inom inte ju kan man med mot när och om på sig sin sina sitt ska skall som
så till under upp ut vad var vara vid vilka vilken vilket än är även också samt enligt får bör sådana
sådan sådant andra annan annat alla all allt varje dock mellan utan""".split())
STOP_EN = set("""a an and any are as at be been by for from has have in into is it its may not of on
or such that the their them these this those to under where which who with shall should other all
each within between without referred""".split())


def ngrams(text: str, n_max: int):
    """Every n-gram of each line, as (n, tokens); none crosses a line break."""
    for line in text.lower().splitlines():
        tokens = TOKEN.findall(line)
        for n in range(1, n_max + 1):
            for i in range(len(tokens) - n + 1):
                yield n, tuple(tokens[i:i + n])


def allowed(gram: tuple[str, ...], stop: set[str]) -> bool:
    return gram[0] not in stop and gram[-1] not in stop and not any(t.isdigit() for t in gram)


def article_counts(articles: dict[str, str], n_max: int, stop: set[str]):
    """Per n-gram: its count in each article; and the total n-grams per length."""
    per: dict[tuple, Counter] = defaultdict(Counter)
    totals: Counter = Counter()
    for art, text in articles.items():
        for n, gram in ngrams(text, n_max):
            totals[n] += 1
            if allowed(gram, stop):
                per[gram][art] += 1
    return per, totals


def log_odds_z(y_a: int, n_a: int, y_b: int, n_b: int) -> float:
    """Monroe et al. (2008), eq. 16 and 18, with the pooled count as the n-gram's prior."""
    alpha, alpha0 = y_a + y_b, n_a + n_b
    delta = (math.log((y_a + alpha) / (n_a + alpha0 - y_a - alpha))
             - math.log((y_b + alpha) / (n_b + alpha0 - y_b - alpha)))
    return delta / math.sqrt(1 / (y_a + alpha) + 1 / (y_b + alpha))


def score(per: dict, act_totals: Counter, reference, top: int = TOP) -> list[dict]:
    """Candidates against a reference corpus (an iterable of texts), ranked by z."""
    cands = {g: c for g, c in per.items() if sum(c.values()) >= MIN_COUNT and len(c) >= MIN_ARTICLES}
    ref_counts: Counter = Counter()
    ref_totals: Counter = Counter()
    for text in reference:
        for n, gram in ngrams(text, 4):
            ref_totals[n] += 1
            if gram in cands:
                ref_counts[gram] += 1
    rows = []
    for gram, c in cands.items():
        y_a, n = sum(c.values()), len(gram)
        z = log_odds_z(y_a, act_totals[n], ref_counts[gram], ref_totals[n])
        if z >= Z_MIN:
            rows.append({"term_sv": " ".join(gram), "act_count": y_a, "act_articles": len(c),
                         "sfs_count": ref_counts[gram], "z": round(z, 2)})
    rows.sort(key=lambda r: (-r["z"], r["term_sv"]))
    return rows[:top]


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
