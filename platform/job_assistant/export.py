"""Write the job assistant's public files from the gold marts, and check them before publication.

    python platform/job_assistant/export.py                  # writes frontend/public/data/job-assistant/
    python platform/job_assistant/export.py --check <root>   # the delivery check of the group

ads.json holds mart_job_assistant_ads (current ads and those removed in the last 30 days, without the
text), the cursor and the last week of mart_job_assistant_runs_daily, which is the record of
scheduled operation. matches.json, texts.json and demand.json come from export_matches.py. The
marts are built by `dbt build --select tag:job_assistant` (platform/models/*/job_assistant).
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import duckdb

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from publish.job_content import instant  # noqa: E402
import export_matches  # noqa: E402
from ads import IT_FIELD, STREAM_URL, store_dir, write_atomic  # noqa: E402
from export_matches import iso, rows  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
DATABASE = Path(os.environ.get("PORTFOLIO_DB", ROOT / "warehouse/portfolio.duckdb"))
OUT = ROOT / "frontend/public/data/job-assistant"
FIELDS = ("id", "headline", "employer", "organisation_number", "municipality", "region", "occupation",
          "employment_type", "working_hours", "published", "changed", "first_seen", "application_deadline",
          "removed_at", "duplicate_of", "source_url", "application_url", "content_hash", "expired")
RUN_DAYS = 7


def build(db, state: dict, now: datetime) -> dict:
    ads = [{"id" if k == "ad_id" else k: iso(v) for k, v in r.items()}
           for r in rows(db, "select * from gold.mart_job_assistant_ads order by published desc nulls last, ad_id desc")]
    since = (now - timedelta(days=RUN_DAYS)).date()
    runs = [{k: iso(v) for k, v in r.items()}
            for r in rows(db, f"select * from gold.mart_job_assistant_runs_daily where day >= '{since}' order by day")]
    return {
        "schema_version": 1,
        "generated_at": now.isoformat(timespec="seconds"),
        "source": {"name": "Arbetsförmedlingen JobTech, JobSearch and JobStream", "url": STREAM_URL,
                   "licence": "CC0 1.0", "occupation_field": {"id": IT_FIELD, "label": "Data/IT"}},
        "fetched_until": state.get("fetched_until"),
        "counts": {"current": sum(1 for r in ads if not r["removed_at"] and not r["expired"]),
                   "removed": sum(1 for r in ads if r["removed_at"]),
                   "duplicates": sum(1 for r in ads if r["duplicate_of"])},
        "runs": runs,
        "ads": ads,
    }


def problems(data: dict, now: datetime) -> list[str]:
    out = []
    if data.get("schema_version") != 1 or not isinstance(data.get("ads"), list):
        return ["ads.json: schema_version 1 with an ads list is required"]
    generated = instant(data.get("generated_at") or "")
    if not generated or not timedelta(0) <= now - generated <= timedelta(days=2):
        out.append("ads.json: generated_at is missing or older than two days")
    if not data["ads"]:
        out.append("ads.json: no ads")
    ids = [a.get("id") for a in data["ads"]]
    if len(ids) != len(set(ids)):
        out.append("ads.json: duplicate ad ids")
    for a in data["ads"]:
        if set(a) != set(FIELDS):
            out.append(f"ad {a.get('id')}: fields differ from the contract")
            break
        if not str(a["source_url"]).startswith("https://"):
            out.append(f"ad {a['id']}: source_url is not https")
        if a["duplicate_of"] and a["duplicate_of"] not in ids:
            out.append(f"ad {a['id']}: duplicate_of points at a missing ad")
    if re.search(r"[\w.+-]+@[\w-]+\.[a-z]{2,}", json.dumps(data["ads"], ensure_ascii=False), re.I):
        out.append("ads.json: an e-mail address is present")
    if not any(r["runs_ok"] for r in data.get("runs") or []):
        out.append("ads.json: no successful run in the last week")
    return out


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--check", type=Path, help="delivery root to check instead of writing")
    args = ap.parse_args()
    now = datetime.now(timezone.utc)
    if args.check:
        def read(name):
            return json.loads((args.check / "job-assistant" / name).read_text(encoding="utf-8"))
        data = read("ads.json")
        found = problems(data, now) + export_matches.problems(read("matches.json"), read("texts.json"),
                                                              {a["id"] for a in data["ads"]})
        print("\n".join(found) or "job-assistant: valid")
        sys.exit(1 if found else 0)
    state = json.loads((store_dir() / "state.json").read_text(encoding="utf-8"))
    db = duckdb.connect(str(DATABASE), read_only=True)
    db.execute("set memory_limit = '1GB'")
    db.execute("set TimeZone = 'UTC'")
    data = build(db, state, now)
    matches, texts, demand = export_matches.build(db, data["generated_at"])
    db.close()
    found = problems(data, now) + export_matches.problems(matches, texts, {a["id"] for a in data["ads"]})
    if found:
        sys.exit("\n".join(found))
    for name, value in (("matches.json", matches), ("texts.json", texts), ("demand.json", demand), ("ads.json", data)):
        write_atomic(OUT / name, value)
    print(f"{OUT}: {len(data['ads'])} ads, {len(matches['matches'])} matches, {len(texts['texts'])} texts, "
          f"{data['counts']}")


if __name__ == "__main__":
    main()
