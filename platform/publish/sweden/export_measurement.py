"""Publish SWEDEN A, Politics of Measurement: what Swedish official statistics publish, by domain.

    python platform/publish/sweden/export_measurement.py

Writes frontend/public/data/sweden/measurement/:
- `summary.json`: per research domain, the number of SCB tables and Kolada key figures, how
  many are current (last period within two years), the finest geography they reach, the
  earliest year and frequencies; plus catalogue totals and the fetch provenance.
- `coverage.json`: domain × year counts of SCB tables whose period range covers the year, per
  finest geography (an upper bound: gaps inside a series are not in the catalogue).
- `items.json`: every classified table and key figure (id, title, domain, catalogue,
  institution, subject, frequency, first and last year, geography), loaded on demand.

Counts describe what is published. They are not a ranking of how important a domain is.
"""
from __future__ import annotations

import json
import os
import sys
from datetime import date
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parents[3]
DATABASE = Path(os.environ.get("PORTFOLIO_DB", ROOT / "warehouse/portfolio.duckdb"))
OUT = ROOT / "frontend/public/data/sweden/measurement"
sys.path.insert(0, str(ROOT / "platform/lib"))

import rawstore  # noqa: E402

GEO = ["national", "county", "municipality", "subarea"]


def rows(con, sql: str) -> list[dict]:
    result = con.sql(sql)
    return [dict(zip(result.columns, r)) for r in result.fetchall()]


def write(name: str, payload: dict) -> Path:
    path = OUT / name
    path.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n",
                    encoding="utf-8")
    return path


def main() -> int:
    con = duckdb.connect(str(DATABASE), read_only=True)
    current = date.today().year - 2
    domains = rows(con, f"""
        select d.domain_id as id, d.label_en, d.label_sv, d.scope_en,
               count(i.item_id) filter (where catalogue = 'scb') as scb_tables,
               count(i.item_id) filter (where catalogue = 'kolada') as kolada_kpis,
               count(i.item_id) filter (where catalogue = 'scb' and is_current) as scb_current,
               count(i.item_id) filter (where catalogue = 'kolada' and is_current) as kolada_current,
               count(i.item_id) filter (where catalogue = 'scb' and geo_resolution in ('municipality', 'subarea')) as scb_municipal,
               count(i.item_id) filter (where catalogue = 'scb' and frequency in ('month', 'quarter')) as scb_subannual,
               min(first_year) as first_year,
               count(distinct institution) filter (where i.item_id is not null) as institutions
        from seeds.research_domains d
        left join gold.mart_sweden_measurement_items i using (domain_id)
        group by all order by any_value(d.sort_order)""")
    for d in domains:
        d["geo"] = {g: 0 for g in GEO}
    for r in rows(con, """select domain_id, geo_resolution, count(*) as n
                          from gold.mart_sweden_measurement_items where catalogue = 'scb'
                          group by all"""):
        next(d for d in domains if d["id"] == r["domain_id"])["geo"][r["geo_resolution"]] = r["n"]

    totals = rows(con, """select catalogue, count(*) as items, min(first_year) as first_year,
                                 max(last_year) as last_year, count(distinct institution) as institutions
                          from gold.mart_sweden_measurement_items group by all order by catalogue""")
    fetched = rawstore.fetch_summary("catalogue")
    write("summary.json", {
        "current_from": current,
        "domains": domains,
        "totals": totals,
        "provenance": {
            "sources": [
                {"name": "SCB Statistikdatabasen API v2", "url": "https://statistikdatabasen.scb.se/api/v2/tables",
                 "licence": "CC0 1.0"},
                {"name": "Kolada API v3 (RKA)", "url": "https://api.kolada.se/v3/kpi",
                 "licence": "Open data from RKA; catalogue metadata only"},
            ],
            "fetched": fetched,
            "run_id": os.environ.get("GITHUB_RUN_ID"),
            "code_sha": os.environ.get("GITHUB_SHA"),
            "models": ["gold.mart_sweden_measurement_items", "gold.mart_sweden_measurement_coverage"],
            "classification": ["platform/seeds/sweden/scb_subject_domains.csv",
                               "platform/seeds/sweden/kolada_area_domains.csv"],
        },
    })

    coverage = con.sql("""select domain_id, year, geo_resolution, tables
                          from gold.mart_sweden_measurement_coverage order by domain_id, year""").fetchall()
    write("coverage.json", {"columns": ["domain", "year", "geo", "tables"],
                            "rows": [list(r) for r in coverage]})

    items = con.sql("""select catalogue, item_id, title, domain_id, institution, subject_label,
                              frequency, first_year, last_year, geo_resolution
                       from gold.mart_sweden_measurement_items
                       order by domain_id, catalogue, item_id""").fetchall()
    write("items.json", {"columns": ["catalogue", "id", "title", "domain", "institution", "subject",
                                     "frequency", "first_year", "last_year", "geo"],
                         "rows": [list(r) for r in items]})
    sys.path.insert(0, str(ROOT / "platform/publish/symbolic"))
    import export_symbolic

    export_symbolic.register([OUT / n for n in ("summary.json", "coverage.json", "items.json")])
    print(f"SWEDEN measurement: {len(items)} items, {len(coverage)} coverage cells -> "
          f"{OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    sys.exit(main())
