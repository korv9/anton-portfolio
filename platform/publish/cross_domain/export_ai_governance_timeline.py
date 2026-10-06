"""Publish the AI governance timeline: AI in the Riksdag and in job ads, month by month.

    python platform/publish/cross_domain/export_ai_governance_timeline.py

Writes frontend/public/data/ai-act/signals.json: one entry per series (labels, numerator and
denominator in words, the dbt model it comes from, the view that explains it) with its monthly
rows (month, numerator, denominator, share, three-month rolling share). The page draws each
series in its own panel on a shared time axis with the AI Act's milestones; series are never
combined or put on one scale. Temporal overlap only.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parents[3]
DATABASE = Path(os.environ.get("PORTFOLIO_DB", ROOT / "warehouse/portfolio.duckdb"))
OUT = ROOT / "frontend/public/data/ai-act"


def main() -> int:
    con = duckdb.connect(str(DATABASE), read_only=True)
    meta = json.loads(con.sql("""select * from seeds.ai_governance_series order by sort_order""")
                      .df().to_json(orient="records", force_ascii=False))
    series = []
    for m in meta:
        rows = con.sql(f"""select strftime(month, '%Y-%m') as month, numerator, denominator, share, share_rolling_3m
                           from gold.mart_ai_governance_timeline where series_id = '{m['series_id']}'
                           order by month""").fetchall()
        if not rows:
            continue
        m["rows"] = [[mo, int(n), int(d), round(s or 0, 7), round(r or 0, 7)] for mo, n, d, s, r in rows]
        series.append(m)
    payload = {
        "columns": ["month", "numerator", "denominator", "share", "share_rolling_3m"],
        "series": series,
        "caveat_en": "Temporal overlap does not prove causation.",
        "caveat_sv": "Samtidighet bevisar inte orsak.",
    }
    path = OUT / "signals.json"
    path.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    sys.path.insert(0, str(ROOT / "platform/publish/symbolic"))
    import export_symbolic

    export_symbolic.register([path])
    print(f"AI governance timeline: {len(series)} series -> {path.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
