"""Publish SWEDEN E, The Lost Futures: how often the Riksdag speaks of the future, and which futures.

    python platform/publish/sweden/export_futures.py

Writes frontend/public/data/sweden/futures/:
- `trends.json`: per theme and calendar year, speeches, future-oriented speeches, the share of
  future-oriented speeches using the theme and matches per thousand words; the share of all
  speeches that are future-oriented, with words per speech, future-marker matches per thousand
  words (null until every session of the year was counted with them) and Spearman's rho of the
  share with speech length; the share within fixed length bands (quartiles of speech length over
  the published years); per theme a linear trend plus one level shift, reported only when the shift
  beats an AR(1)-around-trend null after Holm's correction over the nine themes; and the yearly
  counts of the security and culture sub-terms (seeds/sweden_futures/future_subterms.csv). Under
  `academic`, the same shares for Swedish DiVA thesis abstracts, once every month is harvested,
  and under `academic.jump` the 2024-25 rise taken apart (export_futures_theses.py).
- `parties.json`: the same share per party and year (cells with at least 50 future-oriented
  speeches).
- `examples.json`: per theme and session, three future-oriented speeches with date, party,
  speaker, a short window around the match and a link to the speech at riksdagen.se.
- `coverage.json`: the sessions counted, their archives' SHA-256 and the years left out.

The running calendar year is left out of both corpora: it is still being spoken and written.
Academic texts (DiVA) are a separate corpus, shown apart and never pooled with the Riksdag.
"""
from __future__ import annotations

import json
import os
import sys
from bisect import bisect_left
from collections import defaultdict
from datetime import date
from pathlib import Path

import duckdb
import numpy as np

from portfolio.core import db, io
from portfolio.core.config import DATABASE, FEATURES, PUBLIC, ROOT
from portfolio.publish.catalog import register
OUT = PUBLIC / "sweden/futures"
sys.path.insert(0, str(ROOT / "platform/publish/sweden"))

import export_futures_theses  # noqa: E402
from export_connections import spearman  # noqa: E402

# A calendar year with less than half the median number of speeches is a partial session edge
# (1993 starts in the autumn). The running year is left out whatever its size.
EDGE = 0.5
# A publication year with fewer Swedish thesis abstracts is not shown.
MIN_THESES = 1000
# The break test: a level shift needs this many years on each side; the null is NULL_RUNS series
# of AR(1) noise around the fitted trend, drawn from SEED; the family of nine themes is corrected
# with Holm at ALPHA.
MIN_SIDE = 3
NULL_RUNS = 999
SEED = 20261021
ALPHA = 0.05


def shift_gain(y: np.ndarray) -> tuple[float, int | None, float]:
    """The level shift that removes most of a linear trend's residual sum of squares: the share
    removed, the index of the first year after it and the shift. A series the trend fits exactly
    has nothing to remove."""
    n = len(y)
    trend = np.column_stack([np.ones(n), np.arange(n, dtype=float)])
    rss0 = np.sum((y - trend @ np.linalg.lstsq(trend, y, rcond=None)[0]) ** 2)
    best = (0.0, None, 0.0)
    if rss0 <= 1e-12 * max(float(y @ y), 1e-300):
        return best
    for k in range(MIN_SIDE, n - MIN_SIDE + 1):
        x = np.column_stack([trend, np.arange(n) >= k])
        beta = np.linalg.lstsq(x, y, rcond=None)[0]
        gain = 1 - np.sum((y - x @ beta) ** 2) / rss0
        if gain > best[0]:
            best = (float(gain), k, float(beta[2]))
    return best


def trend_break(years: list[int], values: list[float], seed: int) -> dict:
    """Linear trend plus one level shift, scored against AR(1) noise around the fitted trend
    (parametric bootstrap). `p` is the share of null series with at least the observed gain."""
    y = np.asarray(values, dtype=float)
    n = len(y)
    trend = np.column_stack([np.ones(n), np.arange(n, dtype=float)])
    beta = np.linalg.lstsq(trend, y, rcond=None)[0]
    fit, e = trend @ beta, y - trend @ beta
    phi = float(np.clip(e[:-1] @ e[1:] / max(e @ e, 1e-300), -0.95, 0.95))
    sigma = float(np.sqrt(np.mean((e[1:] - phi * e[:-1]) ** 2)))
    gain, k, shift = shift_gain(y)
    rng = np.random.default_rng(seed)
    null = np.empty(NULL_RUNS)
    for i in range(NULL_RUNS):
        u = rng.normal(0, sigma, n)
        z = np.empty(n)
        z[0] = u[0] / np.sqrt(1 - phi ** 2)
        for j in range(1, n):
            z[j] = phi * z[j - 1] + u[j]
        null[i] = shift_gain(fit + z)[0]
    return {"first_year_after": years[k] if k is not None else None, "shift": round(shift, 5),
            "gain": round(gain, 3), "null_p95": round(float(np.quantile(null, 0.95)), 3),
            "p": round((1 + int(np.sum(null >= gain))) / (NULL_RUNS + 1), 4),
            "trend_per_year": round(float(beta[1]), 5), "ar1": round(phi, 2)}


def holm(p: list[float]) -> list[float]:
    """Holm-adjusted p-values, in the input order."""
    out, running = [0.0] * len(p), 0.0
    for i, k in enumerate(sorted(range(len(p)), key=p.__getitem__)):
        running = max(running, min(1.0, (len(p) - i) * p[k]))
        out[k] = running
    return out


def breaks(series: list[tuple[list[int], list[float]]]) -> list[dict]:
    """One trend_break per series, Holm over the family; the shift and its year are kept only
    where the adjusted p is at most ALPHA."""
    tests = [trend_break(years, values, SEED + i) for i, (years, values) in enumerate(series)]
    for t, adjusted in zip(tests, holm([t["p"] for t in tests])):
        t["p_holm"] = round(adjusted, 4)
        t["reported"] = adjusted <= ALPHA and t["first_year_after"] is not None
        if not t["reported"]:
            t["first_year_after"] = t["shift"] = None
    return tests


def length_bands(con, kept: set[int]) -> dict:
    """Future share per year within four fixed length bands, cut at the quartiles of speech
    length over the kept years, and the share standardised to the pooled band mix."""
    rows = [r for r in con.sql("""select year, words, speeches, future_speeches
                                  from gold.mart_sweden_future_lengths""").fetchall() if r[0] in kept]
    by_words: dict[int, int] = defaultdict(int)
    for _, w, n, _ in rows:
        by_words[w] += n
    total, seen, cuts = sum(by_words.values()), 0, []
    for w in sorted(by_words):
        seen += by_words[w]
        while len(cuts) < 3 and seen >= total * (len(cuts) + 1) / 4:
            cuts.append(w)
    cells: dict = defaultdict(lambda: [0, 0])
    for y, w, n, f in rows:
        cell = cells[(y, bisect_left(cuts, w))]
        cell[0] += n
        cell[1] += f
    mix = [sum(c[0] for (_, b), c in cells.items() if b == band) / total for band in range(4)]
    years = sorted({y for y, _ in cells})
    return {
        "upper_words": cuts,
        "columns": ["year", "band", "speeches", "future_share"],
        "rows": [[y, b, n, round(f / n, 5)] for (y, b), (n, f) in sorted(cells.items())],
        "standardised": [[y, round(sum(mix[b] * cells[(y, b)][1] / cells[(y, b)][0]
                                       for b in range(4) if cells[(y, b)][0]), 5)] for y in years],
    }


def write(name: str, payload: dict) -> None:
    io.write_json(OUT / name, payload)


def kept_years(per_year: dict[int, int], running: int) -> set[int]:
    """Years with at least EDGE × the median speeches, before the running year."""
    sizes = sorted(per_year.values())
    median = sizes[len(sizes) // 2]
    return {y for y, n in per_year.items() if n >= EDGE * median and y < running}


def yearly(con, running: int) -> tuple[dict[int, int], set[int], list[list]]:
    """Speeches per year, the years kept, and per kept year the future share, words per speech
    and future-marker matches per thousand words, rounded as published."""
    years = con.sql("""select year, speeches, future_share, words_per_speech, marker_per_1000_words
                       from gold.mart_sweden_future_trends_total order by year""").fetchall()
    per_year = {r[0]: r[1] for r in years}
    kept = kept_years(per_year, running)
    share = [[y, round(s, 5), round(w, 1), None if m is None else round(m, 3)]
             for y, _, s, w, m in years if y in kept]
    return per_year, kept, share


def academic(con, themes: list[dict], running: int) -> dict | None:
    """The academic corpus, side by side and never pooled: full years with at least MIN_THESES
    abstracts. Absent until every month is harvested with record ids and Swedish-only abstracts."""
    done = FEATURES / "sweden/futures_theses/done.json"
    if not done.exists() or not json.loads(done.read_text()).get("complete"):
        return None
    theses = con.sql("""select theme, year, abstracts, future_share, future_share_using, per_1000_words
                        from gold.mart_sweden_future_theses
                        join gold.mart_sweden_future_theses_total using (year)
                        order by theme, year""").fetchall()
    years = sorted({r[1] for r in theses if r[2] >= MIN_THESES and r[1] < running})
    by_year = {r[1]: r for r in theses}  # abstracts and future_share repeat on every theme row
    detail = FEATURES / "sweden/futures_theses_detail/done.json"
    jump = None
    if detail.exists() and json.loads(detail.read_text()).get("complete"):
        cells = con.sql(f"select {', '.join(export_futures_theses.COLUMNS)} "
                        "from gold.mart_sweden_future_theses_detail").fetchall()
        jump = export_futures_theses.jump(cells, [y for y in years if y >= 2019])
    return {
        "corpus": "Swedish-language student-thesis abstracts, DiVA (CC0 metadata)",
        "future_share": [[y, round(by_year[y][3], 5), by_year[y][2]] for y in years],
        "themes": {t["id"]: [[r[1], round(r[4] or 0, 5), round(r[5] or 0, 4)] for r in theses
                             if r[0] == t["id"] and r[1] in years] for t in themes},
        "jump": jump,
    }


def main() -> int:
    con = db.warehouse(DATABASE)
    terms = con.sql("""select term_id, family, label_en, label_sv, description_en, pattern
                       from seeds.future_terms order by sort_order""").fetchall()
    keys = ["id", "family", "label_en", "label_sv", "description_en", "pattern"]
    marker = dict(zip(keys, next(t for t in terms if t[1] == "marker")))
    themes = [dict(zip(keys, t)) for t in terms if t[1] == "theme"]
    rows = con.sql("""select theme, year, speeches, future_speeches, words, speeches_using, future_using,
                             matches, future_share_using, per_1000_words
                      from gold.mart_sweden_future_trends
                      join gold.mart_sweden_future_trends_total using (year)
                      order by theme, year""").fetchall()
    running = date.today().year
    per_year, kept, share = yearly(con, running)
    out = []
    for t in themes:
        mine = [r for r in rows if r[0] == t["id"] and r[1] in kept]
        out.append({**t, "rows": [[r[1], r[2], r[3], r[4], r[6], r[7], round(r[8], 5), round(r[9], 4)]
                                  for r in mine]})
    for t, test in zip(out, breaks([([r[0] for r in t["rows"]], [r[6] for r in t["rows"]]) for t in out])):
        t["break"] = test
    subterms = con.sql("""select s.term_id, s.theme, s.label_en, s.label_sv, s.description_en, s.pattern,
                                 list([m.year, m.future_using, m.matches, round(m.future_share_using, 5)]
                                      order by m.year)
                          from seeds.future_subterms s join gold.mart_sweden_future_subterms m on m.subterm = s.term_id
                          where list_contains(?, m.year)
                          group by all order by any_value(s.sort_order)""", params=[sorted(kept)]).fetchall()
    rho = spearman(np.array([r[1] for r in share]), np.array([r[2] for r in share]))
    write("trends.json", {
        "columns": ["year", "speeches", "future_speeches", "words", "future_using", "matches",
                    "future_share_using", "per_1000_words"],
        "marker": marker,
        "themes": out,
        "future_share_columns": ["year", "future_share", "words_per_speech", "marker_per_1000_words"],
        "future_share": share,
        "length": {"spearman_share_words_per_speech": round(rho, 2), "years": len(share)},
        "length_bands": length_bands(con, kept),
        "subterm_columns": ["year", "future_using", "matches", "future_share_using"],
        "subterms": [dict(zip(["id", "theme", "label_en", "label_sv", "description_en", "pattern", "rows"],
                              [*s[:6], [[int(y), int(f), int(m), v] for y, f, m, v in s[6]]])) for s in subterms],
        "academic": academic(con, themes, running),
        "method": {
            "unit": "one speech in the chamber (anförande), replies included",
            "future_share": "speeches matching the future marker / all speeches",
            "words_per_speech": "words of all speeches / speeches; the share rises with speech length",
            "marker_per_1000_words": "future-marker matches per thousand words of all speeches",
            "future_share_using": "future-oriented speeches using the theme / future-oriented speeches",
            "per_1000_words": "theme matches per thousand words of all speeches",
            "length_bands": ("future share within four bands of words per speech, cut at the quartiles over the "
                             "published years (upper_words); standardised: weighted by the pooled band mix"),
            "break": (f"linear trend plus one level shift in future_share_using, at least {MIN_SIDE} years per side, "
                      "by least squares; gain: share of the trend's residual sum of squares the shift removes; "
                      f"null: {NULL_RUNS} series of AR(1) noise around the fitted trend (seed {SEED} + theme index); "
                      "p: share of null gains at least as large; Holm over the nine themes; the year is reported "
                      f"only when the adjusted p is at most {ALPHA}"),
            "subterms": "the security and culture patterns split into sub-terms; their matches add up to the theme's",
            "years": f"a year with fewer than {EDGE} × the median speeches, and the running year, are left out",
        },
    })
    parties = con.sql("""select party, theme, year, sum(future_speeches), sum(future_using)
                         from gold.mart_sweden_future_themes
                         join gold.mart_sweden_future_totals using (year, party)
                         where party is not null
                         group by all having sum(future_speeches) >= 50 order by 1, 2, 3""").fetchall()
    write("parties.json", {"columns": ["party", "theme", "year", "future_speeches", "future_using"],
                           "rows": [list(r) for r in parties if r[2] in kept],
                           "note": "cells with fewer than 50 future-oriented speeches are left out"})
    src = (FEATURES / "sweden/futures/examples_*.parquet").as_posix()
    examples = duckdb.sql(f"""select theme, session, date, party, speaker, url, matched, context
                              from read_parquet('{src}', union_by_name = true)
                              order by theme, session, date, url""").fetchall()
    write("examples.json", {"columns": ["theme", "session", "date", "party", "speaker", "url", "matched", "context"],
                            "rows": [list(r) for r in examples],
                            "note": "Three future-oriented speeches per theme and session, drawn by the lowest hash of the speech id. Source: Riksdagen, open data."})
    manifests = [json.loads(p.read_text()) for p in sorted((FEATURES / "sweden/futures").glob("manifest_*.json"))]
    write("coverage.json", {
        "sessions": [{k: m.get(k) for k in ("session", "source_url", "sha256", "speeches",
                                             "dictionary_sha256", "counted_at")} for m in manifests],
        "years_left_out": [{"year": y, "speeches": n, "reason": "running year" if y >= running else "partial session"}
                           for y, n in sorted(per_year.items()) if y not in kept],
        "run_id": os.environ.get("GITHUB_RUN_ID"), "code_sha": os.environ.get("GITHUB_SHA"),
        "academic_corpus": "Swedish-language DiVA student-thesis abstracts, counted by platform/ingest/diva/futures_theses.py; shown apart, never pooled",
    })
    register([OUT / n for n in ("trends.json", "parties.json", "examples.json", "coverage.json")])
    print(f"SWEDEN futures: {len(manifests)} sessions, years {min(kept)}–{max(kept)} -> {OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    sys.exit(main())
