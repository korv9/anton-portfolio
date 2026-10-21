"""Publish SWEDEN E, The Lost Futures: how often the Riksdag speaks of the future, and which futures.

    python platform/publish/sweden/export_futures.py

Writes frontend/public/data/sweden/futures/:
- `trends.json`: per theme and calendar year, speeches, future-oriented speeches, the share of
  future-oriented speeches using the theme and matches per thousand words; the share of all
  speeches that are future-oriented, with words per speech, future-marker matches per thousand
  words (null until every session of the year was counted with them) and Spearman's rho of the
  share with speech length; per theme the single most likely break (exploratory). Under
  `academic`, the same shares for Swedish DiVA thesis abstracts, once every month is harvested.
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
from datetime import date
from pathlib import Path

import duckdb
import numpy as np

ROOT = Path(__file__).resolve().parents[3]
DATABASE = Path(os.environ.get("PORTFOLIO_DB", ROOT / "warehouse/portfolio.duckdb"))
FEATURES = Path(os.environ.get("PORTFOLIO_FEATURES", ROOT / "warehouse/features"))
OUT = ROOT / "frontend/public/data/sweden/futures"
sys.path.insert(0, str(ROOT / "platform/publish/sweden"))

from export_connections import spearman  # noqa: E402
from export_language import one_break  # noqa: E402

# A calendar year with less than half the median number of speeches is a partial session edge
# (1993 starts in the autumn). The running year is left out whatever its size.
EDGE = 0.5
# A publication year with fewer Swedish thesis abstracts is not shown.
MIN_THESES = 1000


def write(name: str, payload: dict) -> None:
    (OUT / name).write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n",
                            encoding="utf-8")


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
    return {
        "corpus": "Swedish-language student-thesis abstracts, DiVA (CC0 metadata)",
        "future_share": [[y, round(by_year[y][3], 5), by_year[y][2]] for y in years],
        "themes": {t["id"]: [[r[1], round(r[4] or 0, 5), round(r[5] or 0, 4)] for r in theses
                             if r[0] == t["id"] and r[1] in years] for t in themes},
    }


def main() -> int:
    con = duckdb.connect(str(DATABASE), read_only=True)
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
                                  for r in mine],
                     "break": one_break([r[1] for r in mine], [r[8] for r in mine])})
    rho = spearman(np.array([r[1] for r in share]), np.array([r[2] for r in share]))
    write("trends.json", {
        "columns": ["year", "speeches", "future_speeches", "words", "future_using", "matches",
                    "future_share_using", "per_1000_words"],
        "marker": marker,
        "themes": out,
        "future_share_columns": ["year", "future_share", "words_per_speech", "marker_per_1000_words"],
        "future_share": share,
        "length": {"spearman_share_words_per_speech": round(rho, 2), "years": len(share)},
        "academic": academic(con, themes, running),
        "method": {
            "unit": "one speech in the chamber (anförande), replies included",
            "future_share": "speeches matching the future marker / all speeches",
            "words_per_speech": "words of all speeches / speeches; the share rises with speech length",
            "marker_per_1000_words": "future-marker matches per thousand words of all speeches",
            "future_share_using": "future-oriented speeches using the theme / future-oriented speeches",
            "per_1000_words": "theme matches per thousand words of all speeches",
            "break": "least-squares split of future_share_using into two means, at least 3 years per side; exploratory",
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
    sys.path.insert(0, str(ROOT / "platform/publish/symbolic"))
    import export_symbolic

    export_symbolic.register([OUT / n for n in ("trends.json", "parties.json", "examples.json", "coverage.json")])
    print(f"SWEDEN futures: {len(manifests)} sessions, years {min(kept)}–{max(kept)} -> {OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    sys.exit(main())
