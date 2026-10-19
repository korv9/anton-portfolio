"""Publish SWEDEN E, The Lost Futures: how often the Riksdag speaks of the future, and which futures.

    python platform/publish/sweden/export_futures.py

Writes frontend/public/data/sweden/futures/:
- `trends.json`: per theme and calendar year, speeches, future-oriented speeches, the share of
  future-oriented speeches using the theme and matches per thousand words; the share of all
  speeches that are future-oriented; per theme the single most likely break (exploratory).
- `parties.json`: the same share per party and year (cells with at least 50 future-oriented
  speeches).
- `examples.json`: per theme and session, three future-oriented speeches with date, party,
  speaker, a short window around the match and a link to the speech at riksdagen.se.
- `coverage.json`: the sessions counted, their archives' SHA-256 and the years left out.

Only the Riksdag corpus is published. Academic texts (DiVA) are a separate corpus and are never
pooled with it.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parents[3]
DATABASE = Path(os.environ.get("PORTFOLIO_DB", ROOT / "warehouse/portfolio.duckdb"))
FEATURES = Path(os.environ.get("PORTFOLIO_FEATURES", ROOT / "warehouse/features"))
OUT = ROOT / "frontend/public/data/sweden/futures"
sys.path.insert(0, str(ROOT / "platform/publish/sweden"))

from export_language import one_break  # noqa: E402

# A calendar year with less than half the median number of speeches is a partial session edge
# (1993 starts in the autumn; the current year is still running).
EDGE = 0.5


def write(name: str, payload: dict) -> None:
    (OUT / name).write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n",
                            encoding="utf-8")


def main() -> int:
    con = duckdb.connect(str(DATABASE), read_only=True)
    terms = con.sql("""select term_id, family, label_en, label_sv, description_en, pattern
                       from seeds.future_terms order by sort_order""").fetchall()
    keys = ["id", "family", "label_en", "label_sv", "description_en", "pattern"]
    marker = dict(zip(keys, next(t for t in terms if t[1] == "marker")))
    themes = [dict(zip(keys, t)) for t in terms if t[1] == "theme"]
    rows = con.sql("""select theme, year, speeches, future_speeches, words, speeches_using, future_using,
                             matches, future_share, future_share_using, per_1000_words
                      from gold.mart_sweden_future_trends order by theme, year""").fetchall()
    per_year = {r[1]: r[2] for r in rows}
    sizes = sorted(per_year.values())
    median = sizes[len(sizes) // 2]
    kept = {y for y, n in per_year.items() if n >= EDGE * median}
    out = []
    for t in themes:
        mine = [r for r in rows if r[0] == t["id"] and r[1] in kept]
        out.append({**t, "rows": [[r[1], r[2], r[3], r[4], r[6], r[7], round(r[9], 5), round(r[10], 4)]
                                  for r in mine],
                     "break": one_break([r[1] for r in mine], [r[9] for r in mine])})
    write("trends.json", {
        "columns": ["year", "speeches", "future_speeches", "words", "future_using", "matches",
                    "future_share_using", "per_1000_words"],
        "marker": marker,
        "themes": out,
        "future_share": [[y, round(next(r[8] for r in rows if r[1] == y), 5)] for y in sorted(kept)],
        "method": {
            "unit": "one speech in the chamber (anförande), replies included",
            "future_share": "speeches matching the future marker / all speeches",
            "future_share_using": "future-oriented speeches using the theme / future-oriented speeches",
            "per_1000_words": "theme matches per thousand words of all speeches",
            "break": "least-squares split of future_share_using into two means, at least 3 years per side; exploratory",
        },
    })
    parties = con.sql("""select party, theme, year, sum(future_speeches), sum(future_using)
                         from gold.mart_sweden_future_themes where party <> 'Unknown'
                         group by all having sum(future_speeches) >= 50 order by 1, 2, 3""").fetchall()
    write("parties.json", {"columns": ["party", "theme", "year", "future_speeches", "future_using"],
                           "rows": [list(r) for r in parties if r[2] in kept],
                           "note": "cells with fewer than 50 future-oriented speeches are left out"})
    src = (FEATURES / "sweden/futures/examples_*.parquet").as_posix()
    examples = duckdb.sql(f"""select theme, session, date, party, speaker, url, matched, context
                              from read_parquet('{src}', union_by_name = true)
                              order by theme, session""").fetchall()
    write("examples.json", {"columns": ["theme", "session", "date", "party", "speaker", "url", "matched", "context"],
                            "rows": [list(r) for r in examples],
                            "note": "Three future-oriented speeches per theme and session, drawn by the lowest hash of the speech id. Source: Riksdagen, open data."})
    manifests = [json.loads(p.read_text()) for p in sorted((FEATURES / "sweden/futures").glob("manifest_*.json"))]
    write("coverage.json", {
        "sessions": [{k: m.get(k) for k in ("session", "source_url", "sha256", "speeches",
                                             "dictionary_sha256", "counted_at")} for m in manifests],
        "years_left_out": [{"year": y, "speeches": n} for y, n in sorted(per_year.items()) if y not in kept],
        "run_id": os.environ.get("GITHUB_RUN_ID"), "code_sha": os.environ.get("GITHUB_SHA"),
        "academic_corpus": "DiVA abstracts: harvested by the diva subject; not yet counted for E",
    })
    sys.path.insert(0, str(ROOT / "platform/publish/symbolic"))
    import export_symbolic

    export_symbolic.register([OUT / n for n in ("trends.json", "parties.json", "examples.json", "coverage.json")])
    print(f"SWEDEN futures: {len(manifests)} sessions, years {min(kept)}–{max(kept)} -> {OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    sys.exit(main())
