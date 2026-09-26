"""Deliver the politics marts that have moved from platform/legacy/ into dbt.

    python platform/publish/export_politics.py           # write the delivery files
    python platform/publish/export_politics.py --check   # compare, write nothing

A subject leaves legacy/ only when this export reproduces the legacy script's delivered file
byte for byte; --check is that reconciliation, and CI runs it on every push. The SQL does
the work; this only serialises rows in the delivery's key order and forms percentages.

Files that legacy/build_gold.py used to write are registered in gold/semantic-model.json
here, with the same entry build_gold would have written (lib/gold_contract.py); build_gold
carries those entries forward untouched.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))

import duckdb  # noqa: E402

import gold_contract  # noqa: E402
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


def vote_marts(connection) -> dict[str, bytes]:
    """gold/marts/votes/<session>.json: each session's roll calls in site order."""
    marts: dict[str, list] = {}
    for row in rows(connection, "select slug, decision from gold.mart_vote_decisions order by file_order"):
        marts.setdefault(row["slug"], []).append(json.loads(row["decision"]))
    return {f"marts/votes/{slug}.json": gold_contract.payload(decisions) for slug, decisions in marts.items()}


# Table files with a semantic-model entry: name -> (query, record builder, entry fields).
TABLES = {
    "mart_party_session_vote": (
        "select * from gold.mart_party_session_vote order by session, party",
        lambda r: {"session": r["session"], "party": r["party"], "roll_calls": r["roll_calls"],
                   "yes_calls": r["yes_calls"], "no_calls": r["no_calls"], "abstain_calls": r["abstain_calls"],
                   "cast_member_votes": int(r["cast_member_votes"]), "recorded_absences": int(r["recorded_absences"]),
                   "cohesion_pct": gold_contract.percentage(int(r["cohesive_member_votes"]), int(r["cast_member_votes"])),
                   "recorded_attendance_pct": gold_contract.percentage(
                       int(r["cast_member_votes"]), int(r["cast_member_votes"]) + int(r["recorded_absences"]))},
        ("One session and party", ["session", "party"], ["session", "party"], "Derived from fact_party_vote", ""),
    ),
    "mart_party_agreement": (
        "select * from gold.mart_party_agreement order by session, party_a, party_b",
        lambda r: {"session": r["session"], "party_a": r["party_a"], "party_b": r["party_b"],
                   "same_position_calls": r["same_position_calls"], "comparable_calls": r["comparable_calls"],
                   "agreement_pct": gold_contract.percentage(r["same_position_calls"], r["comparable_calls"])},
        ("One session and ordered party pair", ["session", "party_a", "party_b"], ["session", "party_a", "party_b"],
         "Derived from comparable Ja/Nej positions", "Not ideological distance; abstentions excluded"),
    ),
}


def deliveries(connection) -> tuple[dict[str, bytes], dict[str, dict]]:
    """Every file this export owns, and the semantic-model table entries among them."""
    files = {"marts/budget-context.json": budget_context(connection), **vote_marts(connection)}
    entries = {}
    for name, (query, build, (grain, key, joins, source, limitations)) in TABLES.items():
        records = [build(row) for row in rows(connection, query)]
        content = gold_contract.payload(records)
        files[f"tables/{name}.json"] = content
        entries[name] = gold_contract.describe(name, records, grain, key, joins, source, limitations, content)
    return files, entries


def semantic_model(files: dict[str, bytes], entries: dict[str, dict]) -> bytes:
    """The model with this export's tables and materialisations brought up to date."""
    model = json.loads((GOLD / "semantic-model.json").read_text(encoding="utf-8"))
    model["tables"].update(entries)
    for relative, content in files.items():
        if relative in model["materializations"] or relative.startswith(("marts/votes/", "tables/")):
            model["materializations"][relative] = gold_contract.fingerprint(content)
    model["materializations"] = dict(sorted(model["materializations"].items()))
    return gold_contract.payload(model)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--check", action="store_true", help="Fail if any delivery would change")
    args = parser.parse_args()
    connection = duckdb.connect(str(DATABASE), read_only=True)
    files, entries = deliveries(connection)
    files["semantic-model.json"] = semantic_model(files, entries)
    changed = []
    for relative, payload in files.items():
        target = GOLD / relative
        current = target.read_bytes().replace(b"\r\n", b"\n") if target.exists() else None
        if payload != current:
            changed.append(relative)
            if not args.check:
                target.write_bytes(payload)
    if args.check and changed:
        raise SystemExit(f"Reconciliation failed; dbt output differs from delivery: {changed}")
    print(f"{'Reconciled' if args.check else 'Exported'} {len(files)} politics deliveries"
          + (f", {len(changed)} changed: {changed}" if changed and not args.check else ""))


if __name__ == "__main__":
    main()
