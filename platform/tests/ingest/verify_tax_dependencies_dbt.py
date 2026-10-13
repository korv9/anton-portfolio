"""Build the real tax decision dependencies in an empty, isolated DuckDB warehouse.

Run: python -X utf8 platform/tests/ingest/verify_tax_dependencies_dbt.py
Fixture records stay inside the temporary warehouse and are never exported.
"""
import csv
import io
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "platform/ingest"))
import run_taxes as taxes  # noqa: E402
from studies_ingest import preparation_request  # noqa: E402
import rawstore  # noqa: E402


def fixtures(raw):
    decisions = list(csv.DictReader((ROOT / "platform/seeds/taxes/tax_decisions.csv").open(encoding="utf-8")))
    bills = sorted({d["bill"] for d in decisions if d["bill"]})
    reports = sorted({d["report"] for d in decisions})
    for session in sorted({b.split(":")[0] for b in bills}):
        records = [{"prop_id": "fixture-" + bill, "session": session,
                    "number": bill.split(":")[1], "title": "Fixture bill " + bill,
                    "date": session[:4] + "-10-01", "department": "Fixture ministry",
                    "committee": "", "reports": [], "has_section": True, "section": "Fixture",
                    "references": [{"kind": "sou", "key": "2020:1", "title": "", "diary": "",
                                    "context": "Fixture preparation", "section": "12.1"}],
                    "source_url": "https://example.invalid/fixture", "fetched_at": "2026-10-13T00:00:00Z"}
                   for bill in bills if bill.startswith(session + ":")]
        code = session.replace("/", "")
        path = rawstore.store("riksdagen", f"studies/preparation/{code}.jsonl.gz",
                              "".join(json.dumps(r) + "\n" for r in records).encode(), url="fixture",
                              body={**preparation_request(session), "pending_bills": []})
        coverage = rawstore.store("riksdagen", f"studies/coverage/{code}.json", b"{}", url="fixture")
        rawstore.complete("riksdagen", f"studies/preparation/{code}", [path, coverage],
                          preparation_request(session))
    for session in sorted({r.split(":")[0] for r in reports}):
        code = session.replace("/", "")
        buffer = io.StringIO()
        writer = csv.writer(buffer)
        documents = []
        for index, report in enumerate(r for r in reports if r.startswith(session + ":")):
            designation = report.split(":")[1]
            for member in range(349):
                writer.writerow([session, designation, f"FIXTURE-{index}", "1", f"Fixture {member}",
                                 str(member), "S", "", "Ja", "sakfrågan", member + 1, "", "",
                                 session[:4] + "-10-01"])
            documents.append({"rm": session, "beteckning": designation, "dok_id": "fixture-" + report,
                              "organ": "FI", "titel": "Fixture report", "datum": session[:4] + "-10-01"})
        vote = rawstore.store("riksdagen", f"votes/{code}.csv.gz", buffer.getvalue().encode(), url="fixture")
        report = rawstore.store("riksdagen", f"reports/{code}-01.json",
                                json.dumps({"dokumentlista": {"dokument": documents}}).encode(), url="fixture")
        rawstore.complete("riksdagen", f"history/{code}", [vote, report], {"session": session})
    return decisions


def main():
    (ROOT / "warehouse").mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="tax-dependencies-", dir=ROOT / "warehouse") as directory:
        temp = Path(directory)
        rawstore.RAW = temp / "raw"
        env = dict(os.environ, PORTFOLIO_RAW=str(rawstore.RAW), PORTFOLIO_DB=str(temp / "test.duckdb"),
                   DBT_SEND_ANONYMOUS_USAGE_STATS="false", PORTFOLIO_FULL_REFRESH="0", PYTHONUTF8="1")
        cold = subprocess.run([sys.executable, "ingest/run_taxes.py", "--skip-fetch"],
                              cwd=ROOT / "platform", env=env, capture_output=True, text=True)
        assert cold.returncode != 0 and "Missing parliament upstream" in cold.stderr
        assert not Path(env["PORTFOLIO_DB"]).exists()
        decisions = fixtures(rawstore.RAW)
        taxes.require_parliament()
        command = [sys.executable, "-m", "dbt.cli.main", "--quiet"]
        options = ["--profiles-dir", ".", "--target-path", str(temp / "target")]
        selected = subprocess.run(command + ["ls", *options, "--select", "+tag:taxes",
                                             "--resource-type", "model", "seed", "--output", "name"],
                                  cwd=ROOT / "platform", env=env, check=True, capture_output=True, text=True)
        names = set(selected.stdout.splitlines())
        required = {"fct_bill", "fct_bill_study", "fct_roll_call", "fct_party_roll_call",
                    "stg_riksdagen_bill_preparation", "stg_riksdagen_votes", "stg_riksdagen_reports",
                    "governments", "committees", "issues", "tax_decisions"}
        assert required <= names, required - names
        build = command + ["build", *options, "--select", "+fct_tax_decision_vote",
                           "+fct_tax_decision_study", "assert_tax_decisions_have_sources",
                           "--indirect-selection", "cautious"]
        subprocess.run(build, cwd=ROOT / "platform", env=env, check=True)
        with duckdb.connect(env["PORTFOLIO_DB"], read_only=True) as con:
            assert con.execute("select count(*) from gold.dim_tax_decision").fetchone()[0] == len(decisions)
            assert con.execute("select count(*) from gold.dim_tax_decision "
                               "where bill is not null and bill_title is null").fetchone()[0] == 0
            assert con.execute("select count(distinct decision_key) from gold.fct_tax_decision_vote").fetchone()[0] == len(decisions)
        results = json.loads((temp / "target/run_results.json").read_text())
        assert all(r["status"] in {"success", "pass"} for r in results["results"])
        print(f"Tax bootstrap verified: {len(decisions)} decisions; {len(results['results'])} dbt nodes/tests; "
              "bill, study, vote and seed parents selected; missing upstream blocks cold runner")


if __name__ == "__main__":
    main()
