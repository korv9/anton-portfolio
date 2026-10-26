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
import sys
from pathlib import Path

from portfolio.core import db, io
from portfolio.core.config import DATABASE, PUBLIC, ROOT
from portfolio.publish.catalog import register

OUT = PUBLIC / "ai-act/jobs"


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
    return io.write_json(OUT / name, payload)


def main() -> int:
    con = db.warehouse(DATABASE)
    OUT.mkdir(parents=True, exist_ok=True)
    terms = rows(con, """select term_id, family, label_en, label_sv, pattern, case_sensitive, description_en
                         from seeds.job_ai_governance_terms order by sort_order""")
    archives = rows(con, """select archive, source_url, sha256, ads, counted_at, dictionary_sha256
                            from gold.dim_job_ai_governance_archive order by archive""")
    # Every term row of a month carries the month's ads; one per month gives the total.
    totals = con.sql("""select sum(ads) as ads, min(month) as first, max(month) as last
                        from (select distinct month, ads from gold.mart_job_ai_governance_terms
                              where field_id = 'ALL')""").df().iloc[0]
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
        from gold.fct_job_ai_governance_example order by term_id, archive desc""")
    summary = {
        "terms": terms, "archives": archives,
        "ads": int(totals.ads), "first_month": str(totals.first)[:7], "last_month": str(totals.last)[:7],
        "source": {"label": "Arbetsförmedlingen / JobTech: historical job ads",
                   "url": "https://data.arbetsformedlingen.se/annonser/historiska/"},
        "method": "dictionary-v1",
    }
    written = [dump("summary.json", summary), dump("monthly.json", monthly),
               dump("fields.json", fields), dump("examples.json", examples)]
    register(written)
    print(f"Job AI governance: {summary['ads']:,} ads, {len(archives)} archives -> {OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
