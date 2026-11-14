"""Export the employer top list from the archive build, for the owner's review before publication.

    python platform/publish/export_employer_top.py [--database warehouse/jobtech/history.duckdb]

Reads gold.mart_job_employer_top (subject jobs_analysis) and writes warehouse/jobtech/employer-top.json:
per period (latest_12_months, year) the 20 employers with the most IT ads, name and ad count only.
The file is outside frontend/public/data and in no delivery spec, so nothing publishes it; the
branch run of refresh-job-analysis.yml uploads it as an artifact. It refuses to write a file that
holds anything shaped like an organisation or personal identity number.
"""
from __future__ import annotations

import argparse
import json
import re
from datetime import datetime, timezone
from pathlib import Path

import duckdb
import jsonschema

from portfolio.core import io
from portfolio.core.config import ROOT

DATABASE = ROOT / "warehouse/jobtech/history.duckdb"
OUT = ROOT / "warehouse/jobtech/employer-top.json"
SCHEMA = ROOT / "configs/delivery/schemas/employer-top.json"
# Ten or twelve digits with an optional dash or plus before the last four (556677-8899, 19900101-1234).
IDENTITY_NUMBER = re.compile(r"(?<![0-9])(?:[0-9]{2})?[0-9]{6}[-+]?[0-9]{4}(?![0-9])")


def build(connection) -> dict:
    result = connection.execute("""
        select period_kind, period_start, period_end, complete, employer_rank, employer_name, ads
        from gold.mart_job_employer_top order by period_kind, employer_rank""")
    periods: dict[str, dict] = {}
    for kind, start, end, complete, rank, name, ads in result.fetchall():
        period = periods.setdefault(kind, {"period_kind": kind, "from": start.isoformat(),
                                           "until": end.isoformat(), "complete": complete, "employers": []})
        period["employers"].append({"rank": rank, "employer": name, "ads": ads})
    return {
        "schema_version": 1,
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source": "Arbetsförmedlingen JobTech, historical ad archives (CC0 1.0)",
        "model": "gold.mart_job_employer_top",
        "method": ("The 20 employers that posted the most IT ads in the latest twelve months whose "
                   "archive was imported in full, and in the latest calendar year with ads. The list "
                   "counts who posted the ad, which can be a staffing or consultancy firm, not who "
                   "hires. Only employers with the organisation number of a legal entity are counted; "
                   "sole traders, whose number is a personal identity number, are left out. Ties are "
                   "ordered by name. Names and counts only."),
        "rows": list(periods.values()),
    }


def problems(data: dict) -> list[str]:
    text = json.dumps(data["rows"], ensure_ascii=False)
    out = ["an identity or organisation number is present"] if IDENTITY_NUMBER.search(text) else []
    out += [f"{p['period_kind']}: more than 20 employers" for p in data["rows"] if len(p["employers"]) > 20]
    return out + ([] if data["rows"] else ["no rows"])


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--database", type=Path, default=DATABASE)
    parser.add_argument("--out", type=Path, default=OUT)
    args = parser.parse_args()
    connection = duckdb.connect(str(args.database), read_only=True)
    data = build(connection)
    connection.close()
    if found := problems(data):
        raise SystemExit("employer top: " + "; ".join(found) + "; nothing written")
    # Not in a delivery spec yet, so the release does not validate it: the export does.
    jsonschema.validate(data, json.loads(SCHEMA.read_text(encoding="utf-8")))
    io.write_json(args.out, data, newline=False)
    print(f"{args.out}: " + ", ".join(f"{p['period_kind']} {len(p['employers'])}" for p in data["rows"]))


if __name__ == "__main__":
    main()
