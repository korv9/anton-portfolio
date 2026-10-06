"""Publish AI governance and compliance words in Swedish job ads.

    python platform/publish/job_ai_governance/export_job_ai_governance.py

Writes under frontend/public/data/ai-act/jobs/:

    summary.json   the dictionary (patterns verbatim), the archives counted (source URL, SHA-256,
                   ads), the period and totals
    monthly.json   month × term for the whole market: ads mentioning the term, all ads, share,
                   three-month rolling share, change in share against a year earlier
    fields.json    year × occupation field × term: mentions, ads, share
    examples.json  example ads per term (headline, occupation, month, a masked window), for
                   judging what the words catch

Shares always carry their denominator. A mention is a dictionary match, not a requirement.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parents[3]
DATABASE = Path(os.environ.get("PORTFOLIO_DB", ROOT / "warehouse/portfolio.duckdb"))
OUT = ROOT / "frontend/public/data/ai-act/jobs"


def rows(con, sql: str) -> list[dict]:
    records = json.loads(con.sql(sql).df().to_json(orient="records", date_format="iso", force_ascii=False))
    for r in records:
        for k, v in r.items():
            if isinstance(v, str) and v.endswith("T00:00:00.000"):
                r[k] = v[:10]
            elif isinstance(v, float):
                r[k] = round(v, 7)
    return records


def dump(name: str, payload) -> Path:
    path = OUT / name
    path.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    return path


def main() -> int:
    con = duckdb.connect(str(DATABASE), read_only=True)
    OUT.mkdir(parents=True, exist_ok=True)
    terms = rows(con, """select term_id, family, label_en, label_sv, pattern, case_sensitive, description_en
                         from seeds.job_ai_governance_terms order by sort_order""")
    archives = rows(con, """select archive, source_url, sha256, ads, counted_at, dictionary_sha256
                            from bronze.stg_job_gov_manifests order by archive""")
    totals = con.sql("""select sum(ads) as ads, min(month) as first, max(month) as last
                        from bronze.stg_job_gov_totals""").df().iloc[0]
    monthly = rows(con, """
        select month, term_id, mention_count, ads, share, share_rolling_3m, share_change_yoy_pp
        from gold.mart_job_ai_governance_terms where field_id = 'ALL' order by term_id, month""")
    for m in monthly:
        m["month"] = m["month"][:7]
    fields = rows(con, """
        select year, field_id, field, term_id, mention_count, ads, share
        from gold.mart_job_ai_governance_yearly where field_id <> 'ALL' and mention_count > 0
        order by year, field, term_id""")
    examples = rows(con, """
        select term_id, publication_month, headline, occupation, field, matched, context, archive
        from bronze.stg_job_gov_examples order by term_id, archive desc""")
    summary = {
        "terms": terms, "archives": archives,
        "ads": int(totals.ads), "first_month": str(totals.first)[:7], "last_month": str(totals.last)[:7],
        "source": {"label": "Arbetsförmedlingen / JobTech: historical job ads",
                   "url": "https://data.arbetsformedlingen.se/annonser/historiska/"},
        "method": "dictionary-v1",
    }
    written = [dump("summary.json", summary), dump("monthly.json", monthly),
               dump("fields.json", fields), dump("examples.json", examples)]
    sys.path.insert(0, str(ROOT / "platform/publish/symbolic"))
    import export_symbolic

    export_symbolic.register(written)
    print(f"Job AI governance: {summary['ads']:,} ads, {len(archives)} archives -> {OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
