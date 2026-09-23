"""Export lexical debate attention for every party, including parties without a budget motion.

Usage: python scripts/export-debate-keywords.py PATH_TO_PARTILEDARDEBATT/analytics.duckdb
"""

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import duckdb


PARTIES = ("C", "KD", "L", "M", "MP", "S", "SD", "V")
FIRST_SESSION = "2014/15"
LAST_SESSION = "2025/26"
OUTPUT = Path(__file__).resolve().parents[1] / "public/data/debates/budgets/speech-keywords-all-parties.json"


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("Pass the path to partiledardebatt/data/analytics.duckdb")
    database = duckdb.connect(sys.argv[1], read_only=True)
    rows = database.execute("""
        with hits as (
            select s.session, s.party, k.expenditure_area,
                   sum(w.occurrences)::bigint as occurrences
            from raw.words w
            join stg_speeches s using (speech_id)
            join budget_area_keywords k on w.word = k.keyword
            where s.eligible
            group by 1, 2, 3
        ), all_cells as (
            select distinct s.session, s.party, a.expenditure_area
            from stg_speeches s
            cross join (select distinct expenditure_area from budget_area_keywords) a
            where s.eligible and s.party in ('C','KD','L','M','MP','S','SD','V')
              and s.session between ? and ?
        ), complete as (
            select c.*, coalesce(h.occurrences, 0) as occurrences
            from all_cells c left join hits h using (session, party, expenditure_area)
        )
        select session, party, expenditure_area, occurrences,
               round(100.0 * occurrences /
                     nullif(sum(occurrences) over (partition by session, party), 0), 4)
                     as keyword_share_pct
        from complete
        order by session, party, expenditure_area
    """, [FIRST_SESSION, LAST_SESSION]).fetchall()
    expected = 27 * len(PARTIES)
    by_session = {}
    for session, *_ in rows:
        by_session[session] = by_session.get(session, 0) + 1
    if not by_session or any(count != expected for count in by_session.values()):
        raise SystemExit(f"Unexpected party/area coverage: {by_session}")
    data = [dict(zip(("session", "party", "expenditure_area", "occurrences", "keyword_share_pct"), row)) for row in rows]
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps({
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source": "https://github.com/korv9/partiledardebatt-analys",
        "definition": "Share of matches from a fixed Swedish keyword list for 27 expenditure areas within each party and session; not a semantic interpretation of all speech.",
        "data": data,
    }, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Exported {len(data)} party/area rows across {len(by_session)} sessions to {OUTPUT}")


if __name__ == "__main__":
    main()
