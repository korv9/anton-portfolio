"""Weighted log-odds with an informative Dirichlet prior (Monroe, Colaresi and Quinn 2008).

Shared by platform/nlp/ai_act_terms.py (the AI Act's vocabulary against statute law) and
platform/nlp/rising_terms.py (job-ad words of the latest twelve months against the twelve before).
The prior for each n-gram is its pooled count over both corpora.
"""
from __future__ import annotations

import math
import re
from collections import Counter, defaultdict

TOKEN = re.compile(r"[0-9a-zåäöéü]+(?:-[0-9a-zåäöéü]+)*")
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
    """Per n-gram: its count in each document; and the total n-grams per length."""
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


def score(per: dict, totals: Counter, reference, min_count: int, min_docs: int, z_min: float,
          top: int, n_max: int = 4) -> list[dict]:
    """Candidates (at least min_count uses in min_docs documents) against a reference corpus (an
    iterable of texts), those with z >= z_min ranked by z: term, count, docs, reference_count, z."""
    cands = {g: c for g, c in per.items() if sum(c.values()) >= min_count and len(c) >= min_docs}
    ref_counts: Counter = Counter()
    ref_totals: Counter = Counter()
    for text in reference:
        for n, gram in ngrams(text, n_max):
            ref_totals[n] += 1
            if gram in cands:
                ref_counts[gram] += 1
    rows = []
    for gram, c in cands.items():
        y_a, n = sum(c.values()), len(gram)
        z = log_odds_z(y_a, totals[n], ref_counts[gram], ref_totals[n])
        if z >= z_min:
            rows.append({"term": " ".join(gram), "count": y_a, "docs": len(c),
                         "reference_count": ref_counts[gram], "z": round(z, 2)})
    rows.sort(key=lambda r: (-r["z"], r["term"]))
    return rows[:top]
