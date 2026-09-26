"""Deliver the politics marts that have moved from platform/legacy/ into dbt.

    python platform/publish/export_politics.py           # write the delivery files
    python platform/publish/export_politics.py --check   # compare, write nothing

A subject leaves legacy/ only when this export reproduces the legacy script's delivered file
byte for byte; --check is that reconciliation, and CI runs it on every push. The SQL does
the work; this only serialises rows in the delivery's key order.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))

import duckdb  # noqa: E402

from common import GOLD, ROOT  # noqa: E402

DATABASE = Path(os.environ.get("PORTFOLIO_DB", ROOT / "warehouse/portfolio.duckdb"))


def rows(connection, sql: str) -> list[dict]:
    cursor = connection.execute(sql)
    names = [column[0] for column in cursor.description]
    return [dict(zip(names, row)) for row in cursor.fetchall()]


def budget_context(connection) -> bytes:
    years = []
    for row in rows(connection, "select * from gold.mart_budget_context order by budget_year"):
        years.append({
            "session": row["session"], "budget_year": row["budget_year"],
            "government_parties": row["government_parties"],
            "agreement_party": row["agreement_parties"],
            "agreement_source_url": row["agreement_source_url"],
            "comparison_source_url": row["comparison_source_url"],
            "decision_document": row["decision_document"],
            "adopted": row["adopted"], "adopted_parties": row["adopted_parties"],
            "adoption_source_url": row["adoption_source_url"],
            "frame_rows": row["frame_rows"], "frame_status": row["frame_status"],
            "decision_point": row["decision_point"],
            "decision_date": row["decision_date"].isoformat() if row["decision_date"] else None,
            "vote_id": row["vote_id"], "party_votes": row["party_votes"],
            "cited_documents": row["cited_documents"], "reservations": row["reservations"],
            "related_speeches": row["related_speeches"], "link_quality": row["link_quality"],
        })
    result = {
        "scope": "Annual central-government budget decisions, parliamentary sessions 2014/15–2025/26",
        "method": "Government and adopted proposal are separate. Party votes refer to the committee's FiU1 point 2, not to every cited motion. Speech links are discovery candidates only.",
        "years": years,
    }
    return (json.dumps(result, ensure_ascii=False, separators=(",", ":")) + "\n").encode("utf-8")


DELIVERIES = {"marts/budget-context.json": budget_context}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--check", action="store_true", help="Fail if any delivery would change")
    args = parser.parse_args()
    connection = duckdb.connect(str(DATABASE), read_only=True)
    changed = []
    for relative, build in DELIVERIES.items():
        payload = build(connection)
        target = GOLD / relative
        current = target.read_bytes().replace(b"\r\n", b"\n") if target.exists() else None
        if payload != current:
            changed.append(relative)
            if not args.check:
                target.write_bytes(payload)
    if args.check and changed:
        raise SystemExit(f"Reconciliation failed; dbt output differs from delivery: {changed}")
    print(f"{'Reconciled' if args.check else 'Exported'} {len(DELIVERIES)} politics deliveries"
          + (f", {len(changed)} changed" if changed and not args.check else ""))


if __name__ == "__main__":
    main()
