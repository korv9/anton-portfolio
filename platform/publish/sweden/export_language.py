"""Publish SWEDEN B, The Ideal Human: what Swedish job ads ask of people, year by year.

    python platform/publish/sweden/export_language.py

Writes frontend/public/data/sweden/language/:
- `trends.json`: per category and year, distinct texts, the crude and the occupation-
  standardised share of texts using the category, and matches per thousand words; per
  category the single most likely break in the standardised share (exploratory).
- `fields.json`: the same per occupation field (share of texts), for the years with data.
- `regions.json`: the same per county.
- `examples.json`: per category, the masked review examples with archive and year.
- `coverage.json`: which archives were counted, from where, and how many ads each held.

Rates count language in advertisements. They do not measure what workers are like or feel.
"""
from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parents[3]
DATABASE = Path(os.environ.get("PORTFOLIO_DB", ROOT / "warehouse/portfolio.duckdb"))
FEATURES = Path(os.environ.get("PORTFOLIO_FEATURES", ROOT / "warehouse/features"))
OUT = ROOT / "frontend/public/data/sweden/language"
# A break is reported only with this many years on each side.
MIN_SEGMENT = 3
# A publication year with fewer distinct texts is the edge of a neighbouring archive (ads from
# late December in next year's file), not a year of its own.
MIN_TEXTS = 10_000
# Examples near contact details are not published: names of contact people sit there.
CONTACT = re.compile(r"kontakt|frågor|ring |nås |mejla|\[e-post\]|\[telefon\]|contact|questions", re.I)


def write(name: str, payload: dict) -> Path:
    path = OUT / name
    path.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n",
                    encoding="utf-8", newline="\n")
    return path


def one_break(years: list[int], values: list[float]) -> dict | None:
    """The split of a series into two constant means with the least squared error, and how
    much of the variance it explains. A description of where the level moved, not a test."""
    n = len(values)
    if n < 2 * MIN_SEGMENT:
        return None
    mean = sum(values) / n
    total = sum((v - mean) ** 2 for v in values)
    if total == 0:
        return None
    best = None
    for k in range(MIN_SEGMENT, n - MIN_SEGMENT + 1):
        a, b = values[:k], values[k:]
        ma, mb = sum(a) / len(a), sum(b) / len(b)
        sse = sum((v - ma) ** 2 for v in a) + sum((v - mb) ** 2 for v in b)
        if best is None or sse < best[0]:
            best = (sse, k, ma, mb)
    sse, k, ma, mb = best
    return {"first_year_after": years[k], "mean_before": round(ma, 5), "mean_after": round(mb, 5),
            "variance_explained": round(1 - sse / total, 3)}


def main() -> int:
    con = duckdb.connect(str(DATABASE), read_only=True)
    terms = con.sql("""select term_id as id, family, label_en, label_sv, description_en, pattern
                       from seeds.ad_language_terms order by sort_order""").fetchall()
    categories = [dict(zip(["id", "family", "label_en", "label_sv", "description_en", "pattern"], t))
                  for t in terms]
    rows = con.sql("""select category, year, texts, texts_matching, matches, words, share,
                             share_standardised, per_1000_words, per_1000_words_standardised
                      from gold.mart_sweden_job_language_trends order by category, year""").fetchall()
    trends = []
    for c in categories:
        mine = [r for r in rows if r[0] == c["id"] and r[2] >= MIN_TEXTS]
        years = [r[1] for r in mine]
        kept = [r for r in mine if r[9] is not None]
        series = [round(r[9], 5) for r in kept]
        trends.append({**c, "rows": [[r[1], r[2], r[3], r[4], r[5], round(r[6], 5), None if r[7] is None else round(r[7], 5),
                                      round(r[8] or 0, 4), None if r[9] is None else round(r[9], 4)] for r in mine],
                       "break": one_break([r[1] for r in kept], series)})
    write("trends.json", {
        "columns": ["year", "texts", "texts_matching", "matches", "words", "share",
                    "share_standardised", "per_1000_words", "per_1000_words_standardised"],
        "categories": trends,
        "method": {
            "unit": "distinct ad text (headline and description); an ad repeated with the same text counts once",
            "share": "texts using the category / distinct texts",
            "share_standardised": "occupation-field mix fixed at its pooled share over all years",
            "per_1000_words": "matches per thousand words of the distinct texts",
            "per_1000_words_standardised": "the same with the occupation-field mix fixed; the main measure, since ads grew longer",
            "break": "least-squares split of the standardised rate per 1,000 words into two means, at least 3 years per side; exploratory",
        },
    })
    for name, column in (("fields.json", "field"), ("regions.json", "region")):
        cells = con.sql(f"""select {column}, category, year, sum(texts), sum(texts_matching)
                            from gold.mart_sweden_job_language
                            join gold.mart_sweden_job_language_totals using (year, field, region)
                            where {column} <> 'Unknown'
                            group by all having sum(texts) >= 30 order by 1, 2, 3""").fetchall()
        write(name, {"columns": [column, "category", "year", "texts", "texts_matching"],
                     "rows": [list(r) for r in cells],
                     "note": "cells with fewer than 30 distinct texts are left out"})
    examples = con.sql("""select category, archive, year, field, headline, matched, context
                          from {src} order by category, archive, ad_id""".format(
        src=f"read_parquet('{(FEATURES / 'sweden/ad_language/examples_*.parquet').as_posix()}', union_by_name = true)"
    )).fetchall()
    write("examples.json", {"columns": ["category", "archive", "year", "field", "headline", "matched", "context"],
                            "rows": [list(r) for r in examples if not CONTACT.search(r[6] or "")],
                            "note": "Drawn reproducibly (lowest hash of the ad text); e-mail addresses and phone numbers masked. Source: JobTech historical ads, CC0."})
    manifests = sorted((FEATURES / "sweden/ad_language").glob("manifest_*.json"))
    coverage = [json.loads(p.read_text()) for p in manifests]
    dropped = sorted({r[1]: r[2] for r in rows if 0 < r[2] < MIN_TEXTS}.items())
    write("coverage.json", {"years_left_out": [{"year": y, "texts": t} for y, t in dropped],
                            "min_texts": MIN_TEXTS, "archives": [{k: m.get(k) for k in (
        "archive", "source_url", "sha256", "ads", "distinct_texts", "duplicate_ids",
        "dictionary_sha256", "counted_at", "from")} for m in coverage],
        "run_id": os.environ.get("GITHUB_RUN_ID"), "code_sha": os.environ.get("GITHUB_SHA")})
    sys.path.insert(0, str(ROOT / "platform/publish/symbolic"))
    import export_symbolic

    export_symbolic.register([OUT / n for n in ("trends.json", "fields.json", "regions.json",
                                                "examples.json", "coverage.json")])
    print(f"SWEDEN language: {len(coverage)} archives, {len(rows)} year × category rows -> "
          f"{OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    sys.exit(main())
