"""Write the job assistant's public ad list, and check it before publication.

    python platform/job_assistant/export.py                  # writes frontend/public/data/job-assistant/
    python platform/job_assistant/export.py --check <root>   # the delivery check of the group

ads.json holds every current ad and those removed in the last 30 days, without the ad text, the
cursor and the last week of hourly runs, which is the record of scheduled operation. matches.json
and texts.json come from export_matches.py.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from publish.job_content import instant  # noqa: E402
import export_matches  # noqa: E402
from ads import IT_FIELD, STREAM_URL, store_dir, write_atomic  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend/public/data/job-assistant"
FIELDS = ("id", "headline", "employer", "organisation_number", "municipality", "region", "occupation",
          "employment_type", "working_hours", "published", "changed", "first_seen", "application_deadline",
          "removed_at", "duplicate_of", "source_url", "application_url", "content_hash")
KEEP_REMOVED = timedelta(days=30)
RUN_DAYS = 7


def build(ads: dict, state: dict, runs: list[dict], now: datetime) -> dict:
    rows = []
    for row in ads.values():
        removed = instant(row["removed_at"]) if row.get("removed_at") else None
        if removed and now - removed > KEEP_REMOVED:
            continue
        deadline = instant(row.get("application_deadline"), deadline=True)
        rows.append({**{k: row.get(k) for k in FIELDS}, "expired": bool(deadline and deadline < now)})
    rows.sort(key=lambda r: (r["published"] or "", r["id"]), reverse=True)
    since = (now - timedelta(days=RUN_DAYS)).isoformat()
    recent = [{"started": r["started"], "finished": r.get("finished"), "outcome": r["outcome"],
               **{k: sum(w.get(k, 0) for w in r["windows"]) for k in ("new", "changed", "removed")}}
              for r in runs if r["started"] >= since]
    return {
        "schema_version": 1,
        "generated_at": now.isoformat(timespec="seconds"),
        "source": {"name": "Arbetsförmedlingen JobTech, JobStream", "url": STREAM_URL,
                   "licence": "CC0 1.0", "occupation_field": {"id": IT_FIELD, "label": "Data/IT"}},
        "fetched_until": state.get("fetched_until"),
        "counts": {"current": sum(1 for r in rows if not r["removed_at"] and not r["expired"]),
                   "removed": sum(1 for r in rows if r["removed_at"]),
                   "duplicates": sum(1 for r in rows if r["duplicate_of"])},
        "runs": recent,
        "ads": rows,
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
        if set(a) != set(FIELDS) | {"expired"}:
            out.append(f"ad {a.get('id')}: fields differ from the contract")
            break
        if not str(a["source_url"]).startswith("https://"):
            out.append(f"ad {a['id']}: source_url is not https")
        if a["duplicate_of"] and a["duplicate_of"] not in ids:
            out.append(f"ad {a['id']}: duplicate_of points at a missing ad")
    if re.search(r"[\w.+-]+@[\w-]+\.[a-z]{2,}", json.dumps(data["ads"], ensure_ascii=False), re.I):
        out.append("ads.json: an e-mail address is present")
    if not data.get("runs") or not any(r["outcome"] == "ok" for r in data["runs"]):
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
    folder = store_dir()
    ads = json.loads((folder / "ads.json").read_text(encoding="utf-8"))
    state = json.loads((folder / "state.json").read_text(encoding="utf-8"))
    runs_file = folder / "runs.jsonl"
    runs = [json.loads(line) for line in runs_file.read_text(encoding="utf-8").splitlines() if line.strip()]
    data = build(ads, state, runs, now)
    store = folder / "matches.json"
    matches, texts = export_matches.build(ads, json.loads(store.read_text(encoding="utf-8")) if store.exists()
                                          else {"profile": None}, data["generated_at"])
    found = problems(data, now) + export_matches.problems(matches, texts, {a["id"] for a in data["ads"]})
    if found:
        sys.exit("\n".join(found))
    write_atomic(OUT / "matches.json", matches)
    write_atomic(OUT / "texts.json", texts)
    write_atomic(OUT / "ads.json", data)
    print(f"{OUT / 'ads.json'}: {len(data['ads'])} ads, {data['counts']}")


if __name__ == "__main__":
    main()
