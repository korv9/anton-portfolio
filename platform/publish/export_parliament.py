"""Export the parliament subject from the warehouse to the site.

    python platform/publish/export_parliament.py

JSON under frontend/public/data/parliament/:
    now.json        where Swedish politics stands: the latest election, the government and its
                    status, the government-formation news, the latest poll and the latest
                    decisions of the Riksdag
    elections.json  Riksdag elections 1973 to the latest, per party: votes, share, seats
    polls.json      SCB's party preference survey (PSU) since 1972, with margins of error
    sessions.json   every riksmöte since 1993/94: government, roll calls, each party's record,
                    and how often each pair of parties voted alike
    issues.json     per policy issue: its committees, decisions per session, how often the
                    government won, the latest decisions, the budget outturn of its expenditure
                    areas, the welfare indicators that describe it, and who debated it

Parquet under frontend/public/data/parquet/parliament_roll_calls/part-0.parquet: every roll
call since 1993/94, for browsing and filtering in the browser.

Run after `dbt build --select tag:parliament`; it refuses to export if that run had a failing test.
"""
from __future__ import annotations

import json
import os
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))

import duckdb  # noqa: E402

from common import PUBLIC, ROOT, write_json  # noqa: E402

DATABASE = Path(os.environ.get("PORTFOLIO_DB", ROOT / "warehouse/portfolio.duckdb"))
RAW = Path(os.environ.get("PORTFOLIO_RAW", ROOT / "warehouse/raw"))
RUN_RESULTS = ROOT / "platform/target/parliament/run_results.json"
OUT = PUBLIC / "parliament"
ROLL_CALLS = PUBLIC / "parquet/parliament_roll_calls/part-0.parquet"
MAJORITY = 175
PARTY_ORDER = ["S", "M", "SD", "V", "C", "KD", "MP", "L", "NYD", "OTHER"]
PARTY_NAMES = {
    "S": "Socialdemokraterna", "M": "Moderaterna", "SD": "Sverigedemokraterna",
    "V": "Vänsterpartiet", "C": "Centerpartiet", "KD": "Kristdemokraterna",
    "MP": "Miljöpartiet", "L": "Liberalerna", "NYD": "Ny demokrati", "OTHER": "Övriga partier",
}


def records(connection, sql: str, parameters=None) -> list[dict]:
    cursor = connection.execute(sql, parameters or [])
    columns = [column[0] for column in cursor.description]
    return [dict(zip(columns, (jsonable(v) for v in row))) for row in cursor.fetchall()]


def jsonable(value):
    if hasattr(value, "isoformat"):
        return value.isoformat()
    if isinstance(value, float):
        return round(value, 4)
    if isinstance(value, list):
        return [jsonable(v) for v in value]
    return value


def check_dbt() -> dict:
    """Refuse to publish a build whose tests failed; report what ran otherwise."""
    if not RUN_RESULTS.is_file():
        raise SystemExit(f"No dbt run results at {RUN_RESULTS}; run the parliament build first")
    results = json.loads(RUN_RESULTS.read_text(encoding="utf-8"))["results"]
    tests = defaultdict(int)
    for result in results:
        if result["unique_id"].startswith("test."):
            tests[result["status"]] += 1
    if tests.get("fail") or tests.get("error"):
        raise SystemExit(f"Refusing to export: dbt tests failed {dict(tests)}")
    return dict(tests)


def formation_news() -> list[dict]:
    """The Riksdag's news items on government formation, merged across searches."""
    seen = {}
    for path in sorted((RAW / "riksdagen/formation").glob("*.json")):
        listing = json.loads(path.read_text(encoding="utf-8-sig"))["dokumentlista"]
        documents = listing.get("dokument") or []
        for document in documents if isinstance(documents, list) else [documents]:
            identifier = document.get("id", "")
            # News items are the CMS documents; the Swedish edition ends in 'sv'.
            if identifier.startswith("cms") and identifier.endswith("sv"):
                seen[identifier] = {
                    "date": document["datum"][:16],
                    "title": " ".join(document["titel"].split()),
                    "summary": " ".join((document.get("notis") or "").split()) or None,
                }
    return sorted(seen.values(), key=lambda item: item["date"], reverse=True)


def party_rows(rows: list[dict]) -> list[dict]:
    order = {party: index for index, party in enumerate(PARTY_ORDER)}
    return sorted(rows, key=lambda row: order.get(row["party"], 99))


def main() -> None:
    tests = check_dbt()
    connection = duckdb.connect(str(DATABASE), read_only=True)

    elections = records(connection, """
        select election_year, party, votes, share_pct, seats, source
        from gold.fct_election order by election_year, party""")
    years = sorted({row["election_year"] for row in elections})
    latest_year, previous_year = years[-1], years[-2]
    by_year = defaultdict(dict)
    for row in elections:
        by_year[row["election_year"]][row["party"]] = row
    val_meta = records(connection, """
        select any_value(election_date) as election_date, any_value(count_status) as count_status,
               any_value(last_updated) as last_updated
        from bronze.stg_val_riksdag_result where election_year = ?""", [latest_year])[0]

    latest_election = {
        "year": latest_year, **val_meta, "majority": MAJORITY,
        "source": by_year[latest_year][next(iter(by_year[latest_year]))]["source"],
        "parties": party_rows([
            {"party": party, "name": PARTY_NAMES.get(party, party), "votes": row["votes"],
             "share_pct": row["share_pct"], "seats": row["seats"],
             "previous_share_pct": by_year[previous_year].get(party, {}).get("share_pct"),
             "previous_seats": by_year[previous_year].get(party, {}).get("seats")}
            for party, row in by_year[latest_year].items()
        ]),
    }

    governments = records(connection, """
        select government_key, government_name, prime_minister, prime_minister_party,
               government_parties, start_date, end_date, agreement_name, agreement_parties,
               status_note, source_url, is_current
        from gold.dim_government order by start_date""")
    current = next(g for g in governments if g["is_current"])

    polls = records(connection, """
        select survey_month, party, share_pct, margin_of_error_pp, change_since_last_survey_pp
        from gold.fct_party_poll order by survey_month, party""")
    latest_poll_month = max(row["survey_month"] for row in polls)

    latest_session = connection.execute(
        "select max(session) from gold.fct_roll_call").fetchone()[0]
    latest_decisions = records(connection, """
        select session, roll_call_id, vote_date, designation, point, committee_code,
               committee_name, issue_key, coalesce(report_headline, report_title) as title,
               report_url, yes, no, abstain, absent, outcome, government_won
        from gold.fct_roll_call
        where is_substantive and vote_date is not null
        order by vote_date desc, designation, try_cast(point as integer)
        limit 15""")
    latest_positions = records(connection, """
        select roll_call_id, party, position from gold.fct_party_roll_call
        where roll_call_id in (select roll_call_id from gold.fct_roll_call
                               where is_substantive and vote_date is not null
                               order by vote_date desc limit 60)""")
    positions = defaultdict(dict)
    for row in latest_positions:
        positions[row["roll_call_id"]][row["party"]] = row["position"]
    for decision in latest_decisions:
        decision["party_positions"] = positions.get(decision["roll_call_id"], {})

    now = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="minutes"),
        "election": latest_election,
        "government": current,
        "formation_news": formation_news(),
        "poll": {
            "survey_month": latest_poll_month,
            "parties": party_rows([row for row in polls if row["survey_month"] == latest_poll_month]),
        },
        "latest_session": latest_session,
        "latest_decisions": latest_decisions,
    }
    write_json(OUT / "now.json", now, indent=1)

    write_json(OUT / "elections.json", {
        "years": years, "majority": MAJORITY, "party_names": PARTY_NAMES,
        "results": elections,
        "note": "SCB for 1973-2022, Valmyndigheten for later elections. Ny demokrati's votes in "
                "1991 and 1994 are inside OTHER in SCB's tables; its seats are shown.",
    })
    write_json(OUT / "polls.json", {"party_names": PARTY_NAMES, "polls": polls})

    sessions = records(connection, """
        select session, start_year, first_vote, last_vote, roll_calls, election_year,
               government_key, government_name, government_parties, agreement_parties
        from gold.dim_parliament_session order by session""")
    record = records(connection, """
        select * from gold.mart_party_session_record order by session, party""")
    pairs = records(connection, """
        select * from gold.mart_party_pair_session order by session, party_a, party_b""")
    government_record = records(connection, """
        select session, count(*) as decisions,
               round(100 * avg(government_won::int), 1) as government_won_pct
        from gold.fct_roll_call where is_substantive and government_won is not null
        group by session order by session""")
    write_json(OUT / "sessions.json", {
        "sessions": sessions, "party_record": record, "party_pairs": pairs,
        "government_record": government_record,
    })

    issues = records(connection, """
        select issue_key, issue_name_sv, issue_name_en, summary_sv, expenditure_areas,
               welfare_indicators, committees
        from gold.dim_issue order by issue_name_sv""")
    per_session = records(connection, """
        select issue_key, session, count(*) as decisions,
               round(100 * avg(government_won::int), 1) as government_won_pct
        from gold.fct_roll_call
        where is_substantive and issue_key is not null
        group by issue_key, session order by issue_key, session""")
    party_issue = records(connection, """
        select issue_key, party, mode(role) as role,
               count(*) as decisions,
               round(100 * avg(case when position in ('yes', 'no') then with_government::int end), 1)
                   as with_government_pct,
               round(100 * avg(case when position in ('yes', 'no') then on_winning_side::int end), 1)
                   as on_winning_side_pct
        from gold.fct_party_roll_call
        where is_substantive and issue_key is not null and vote_date >= ?
        group by issue_key, party order by issue_key, party""", [current["start_date"]])
    recent = records(connection, """
        select issue_key, session, roll_call_id, vote_date, designation, point,
               coalesce(report_headline, report_title) as title, report_url, yes, no, outcome,
               government_won
        from (select *, row_number() over (partition by issue_key
                                           order by vote_date desc, designation, point) as rank
              from gold.fct_roll_call where is_substantive and issue_key is not null
                and vote_date is not null)
        where rank <= 8 order by issue_key, vote_date desc""")

    outturn_path = PUBLIC / "gold/tables/fact_budget_outturn.json"
    outturn = json.loads(outturn_path.read_text(encoding="utf-8"))
    outturn = outturn.get("data", outturn) if isinstance(outturn, dict) else outturn
    budget = defaultdict(lambda: defaultdict(float))
    area_to_issues = defaultdict(list)
    for issue in issues:
        for area in issue["expenditure_areas"]:
            area_to_issues[area].append(issue["issue_key"])
    for row in outturn:
        for issue_key in area_to_issues.get(int(row["expenditure_area"]), []):
            if row.get("outturn_msek") is not None:
                budget[issue_key][int(row["budget_year"])] += float(row["outturn_msek"])

    welfare = records(connection, """
        with national as (
            select f.indicator_key, f.age_group_key, p.reference_year, p.period_type, f.value
            from gold.fct_indicator as f
            join gold.dim_period as p using (period_key)
            where f.region_code = '00' and f.sex_key = 'T' and p.period_type = 'year'
        ), band as (
            select indicator_key, arg_max(age_group_key, n) as age_group_key
            from (select indicator_key, age_group_key, count(*) as n from national group by all)
            group by indicator_key
        )
        select n.indicator_key, i.indicator_name, i.unit, i.higher_is_better,
               n.reference_year as year, n.value
        from national as n
        join band using (indicator_key, age_group_key)
        join gold.dim_indicator as i using (indicator_key)
        order by n.indicator_key, year""")
    welfare_by_key = defaultdict(list)
    for row in welfare:
        welfare_by_key[row["indicator_key"]].append(row)

    speeches = records(connection, """
        with titles as (
            select session, lower(trim(report_title)) as title, min(issue_key) as issue_key
            from gold.fct_roll_call
            where report_title is not null and issue_key is not null
            group by all
        ), cards as (
            select session, lower(trim(title)) as title, party
            from read_parquet(?, hive_partitioning = false)
            where kind = 'issues' and party is not null and party not in ('', '-')
        )
        select t.issue_key, c.session, c.party, count(*) as speeches
        from cards as c join titles as t using (session, title)
        group by all order by all""",
        [(PUBLIC / "parquet/speech_cards/*/*.parquet").as_posix()])
    speech_coverage = connection.execute("""
        select count(*) filter (where t.issue_key is not null) / count(*)
        from read_parquet(?, hive_partitioning = false) as c
        left join (select distinct session, lower(trim(report_title)) as title, issue_key
                   from gold.fct_roll_call where report_title is not null) as t
            on t.session = c.session and t.title = lower(trim(c.title))
        where c.kind = 'issues'""", [(PUBLIC / "parquet/speech_cards/*/*.parquet").as_posix()]
    ).fetchone()[0]

    recent_positions = records(connection, """
        select roll_call_id, party, position from gold.fct_party_roll_call
        where roll_call_id in (select unnest(?))""", [[row["roll_call_id"] for row in recent]])
    by_roll_call = defaultdict(dict)
    for row in recent_positions:
        by_roll_call[row["roll_call_id"]][row["party"]] = row["position"]
    for row in recent:
        row["party_positions"] = by_roll_call.get(row["roll_call_id"], {})

    grouped = defaultdict(lambda: defaultdict(list))
    for name, rows in (("per_session", per_session), ("parties", party_issue),
                       ("recent_decisions", recent), ("speeches", speeches)):
        for row in rows:
            grouped[row["issue_key"]][name].append({k: v for k, v in row.items() if k != "issue_key"})
    for issue in issues:
        key = issue["issue_key"]
        issue.update({name: grouped[key][name] for name in
                      ("per_session", "parties", "recent_decisions", "speeches")})
        issue["budget_outturn_msek"] = [{"year": year, "outturn_msek": round(value)}
                                        for year, value in sorted(budget[key].items())]
        issue["welfare"] = [{"indicator_key": indicator,
                             "indicator_name": welfare_by_key[indicator][0]["indicator_name"],
                             "unit": welfare_by_key[indicator][0]["unit"],
                             "higher_is_better": welfare_by_key[indicator][0]["higher_is_better"],
                             "series": [{"year": r["year"], "value": r["value"]}
                                        for r in welfare_by_key[indicator]]}
                            for indicator in issue["welfare_indicators"] if welfare_by_key.get(indicator)]
    write_json(OUT / "issues.json", {
        "issues": issues,
        "speech_link_coverage": round(speech_coverage, 3),
        "notes": {
            "parties": "Decisions under the current government: how often each party voted "
                       "with the government and was on the winning side.",
            "speeches": "Issue-debate speeches linked when the debate title is the committee "
                        "report's title; about this share of such speeches is linked.",
            "budget": "Outturn (Statskontoret) of the expenditure areas the issue's committees decide.",
            "welfare": "Descriptive: read side by side, not as an effect of decisions.",
        },
    })

    ROLL_CALLS.parent.mkdir(parents=True, exist_ok=True)
    connection.execute(f"""
        copy (
            select session, roll_call_id, vote_date, designation, point, is_substantive,
                   committee_code, issue_key, coalesce(report_headline, report_title) as title,
                   report_url, yes, no, abstain, absent, outcome, government_position,
                   government_won
            from gold.fct_roll_call
            order by session, vote_date, designation, point, roll_call_id
        ) to '{ROLL_CALLS.as_posix()}' (format parquet, compression snappy)""")
    print(f"parliament: election {latest_year}, {len(sessions)} sessions, {len(issues)} issues, "
          f"latest poll {latest_poll_month}; dbt tests {tests}")


if __name__ == "__main__":
    main()
