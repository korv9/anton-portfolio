"""Write the job assistant's public files from the gold marts, and check them before publication.

    python platform/job_assistant/export.py                  # writes frontend/public/data/job-assistant/
    python platform/job_assistant/export.py --check <root>   # the delivery check of the group

ads.json holds mart_job_assistant_ads (current ads and those removed in the last 30 days, without the
text), the cursor and the last week of mart_job_assistant_runs_daily, which is the record of
scheduled operation. time-to-close.json holds mart_job_assistant_time_to_close (days from
publication to removal of the removed ads, per occupation and outcome). matches.json, texts.json, texts-remaining.json and demand.json come from
export_matches.py. The
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
MIN_ADS = 20  # the dbt var time_to_close_min_ads: below it the mart publishes no median


def pipeline(state: dict, now: datetime) -> dict:
    """The last successful fetch, and the latency of the last day's uploaded publications, for the page.

    Both flows fetch through ads.py, which logs every run in runs.jsonl: the last ok run there is the
    last fetch. pipeline.json and realtime_runs.jsonl (realtime.py, Airflow) travel with the store, so
    after an Airflow session the hourly runs restore them: the flow is realtime only while Airflow's
    last collect is what moved the cursor, and latency counts only publications uploaded to R2.
    """
    folder = store_dir()
    status = json.loads((folder / "pipeline.json").read_text(encoding="utf-8")) if (folder / "pipeline.json").exists() else {}
    collect = (status.get("collect") or {}).get("ok") or {}
    runs = (folder / "runs.jsonl").read_text(encoding="utf-8").splitlines() if (folder / "runs.jsonl").exists() else []
    last = next((r for r in map(json.loads, reversed(runs)) if r["outcome"] == "ok"), None)
    fetch = last and {"at": last["finished"], "fetched_until": state.get("fetched_until")}
    since = (now - timedelta(days=1)).isoformat()
    log = folder / "realtime_runs.jsonl"
    day = [e for e in map(json.loads, log.read_text(encoding="utf-8").splitlines() if log.exists() else [])
           if e["finished"] >= since]
    latencies = sorted(e["latency"]["max_minutes"] for e in day
                       if e["stage"] == "publish" and e["outcome"] == "ok" and e.get("mode") == "r2" and e.get("latency"))
    realtime = bool(collect) and collect.get("fetched_until") == state.get("fetched_until")
    return {"flow": "realtime" if realtime else "hourly", "last_fetch": fetch,
            "latency_minutes": {"median": latencies[len(latencies) // 2] if latencies else None,
                                "publications": len(latencies)},
            "last_day": last_day(day)}


def last_day(entries: list[dict]) -> dict:
    """The last day's stage runs from realtime_runs.jsonl: cycles that reached publish, failed stages,
    changes collected, the median seconds of a cycle (collect to publish) and Workers AI neurons."""
    cycles, seconds = [], 0.0
    for e in entries:
        seconds = (0.0 if e["stage"] == "collect" else seconds) + e.get("seconds", 0)
        if e["stage"] == "publish" and e["outcome"] == "ok":
            cycles.append(seconds)
    cycles.sort()
    return {"runs": len(cycles), "failed": sum(1 for e in entries if e["outcome"].startswith("failed")),
            "changes": sum(e.get("new", 0) + e.get("changed", 0) + e.get("removed", 0)
                           for e in entries if e["stage"] == "collect" and e["outcome"] == "ok"),
            "run_seconds_median": round(cycles[len(cycles) // 2], 1) if cycles else None,
            "workers_ai_neurons": round(sum(e.get("workers_ai_neurons") or 0 for e in entries), 2)}


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
        "pipeline": pipeline(state, now),
        "counts": {"current": sum(1 for r in ads if not r["removed_at"] and not r["expired"]),
                   "removed": sum(1 for r in ads if r["removed_at"]),
                   "duplicates": sum(1 for r in ads if r["duplicate_of"])},
        "runs": runs,
        "ads": ads,
    }


def time_to_close(db, now: datetime) -> dict:
    """Days from publication to removal, per occupation ('all' for every one) and outcome."""
    found = rows(db, """select occupation, outcome, ads, median_days_open
        from gold.mart_job_assistant_time_to_close
        order by occupation = 'all' desc, ads desc, occupation, outcome""")
    return {
        "schema_version": 1,
        "generated_at": now.isoformat(timespec="seconds"),
        "source": "gold.mart_job_assistant_time_to_close (JobTech JobStream, Data/IT ads)",
        "window_days": 30,
        "min_ads": MIN_ADS,
        "method": ("The Data/IT ads JobTech removed in the last 30 days, each counted once (later "
                   "copies left out): days from the publication day to the removal day, Stockholm "
                   "time. before_deadline: removed before the application deadline, which usually "
                   "means filled or withdrawn; to_deadline: removed at or after it; no_deadline: no "
                   "deadline given. The median is shown only over at least 20 ads. Ads removed "
                   "earlier than 30 days ago are not in the window, so long-running ads weigh more "
                   "than in a full cohort."),
        "rows": found,
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
    if not ((data.get("pipeline") or {}).get("last_fetch") or {}).get("at"):
        out.append("ads.json: pipeline.last_fetch is missing")
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
        texts = read("texts.json")
        found = (problems(data, now) + export_matches.problems(read("matches.json"), texts, export_matches.open_ids(data))
                 + export_matches.remaining_problems(texts, read("texts-remaining.json"), data))
        print("\n".join(found) or "job-assistant: valid")
        sys.exit(1 if found else 0)
    state = json.loads((store_dir() / "state.json").read_text(encoding="utf-8"))
    db = duckdb.connect(str(DATABASE), read_only=True)
    db.execute("set memory_limit = '1GB'")
    db.execute("set TimeZone = 'UTC'")
    data = build(db, state, now)
    closing = time_to_close(db, now)
    # rank.py's note on the profile route is provenance of the run, read from the raw store as state is.
    note = json.loads((store_dir() / "matches.json").read_text(encoding="utf-8")).get("note")
    matches, texts, demand, remaining = export_matches.build(db, data["generated_at"], note)
    db.close()
    found = (problems(data, now) + export_matches.problems(matches, texts, export_matches.open_ids(data))
             + export_matches.remaining_problems(texts, remaining, data))
    if found:
        sys.exit("\n".join(found))
    for name, value in (("matches.json", matches), ("texts.json", texts), ("texts-remaining.json", remaining),
                        ("demand.json", demand), ("time-to-close.json", closing), ("ads.json", data)):
        write_atomic(OUT / name, value)
    print(f"{OUT}: {len(data['ads'])} ads, {len(matches['matches'])} matches, {len(texts['texts'])}+{len(remaining['texts'])} texts, "
          f"{data['counts']}")


if __name__ == "__main__":
    main()
