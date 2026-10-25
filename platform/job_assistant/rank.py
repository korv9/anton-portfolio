"""Match every current ad with the latest approved profile, after each hourly ad update.

    python platform/job_assistant/rank.py [--profile v3.json]

The profile comes from --profile, or from the Worker's public profile route (JOB_ASSIST_API,
default https://antonernstsson.com/api/jobs/profile). Without an approved profile (none approved
yet, or the route answers anything but 200 or cannot be reached) nothing is matched: an existing
matches.json is kept, and otherwise an empty one says why, so dbt and the ad list still build. Data
is real or absent. Matches are written to warehouse/raw/job_assistant/matches.json, in rank order,
where dbt reads them (models/*/job_assistant); a match is redone when the ad's content hash, the
profile version or the engine changes, and a kept explanation survives as long as its match does.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import ai  # noqa: E402
from ads import LOCAL, STAMP, load_ads, store_dir, write_atomic  # noqa: E402
from cv_profile import problems  # noqa: E402
from match import ENGINE, LISTED, match, order  # noqa: E402

API = os.environ.get("JOB_ASSIST_API", "https://antonernstsson.com/api/jobs")


def approved_profile(path: Path | None) -> tuple[dict | None, str]:
    """The approved profile and where it came from, or None and why there is none yet."""
    if path:
        profile = json.loads(path.read_text(encoding="utf-8"))
    else:
        import requests
        try:
            response = requests.get(API + "/profile", timeout=30)
        except requests.RequestException as error:
            return None, f"profile route unreachable: {type(error).__name__}"
        # 503: the Worker has no D1 binding yet (docs/job-assistant.md, What the owner applies). 403
        # comes from Cloudflare's edge in front of the Worker, which refuses the Actions runner.
        if response.status_code != 200:
            if response.status_code not in (404, 503):
                print(f"::warning::{API}/profile answered {response.status_code}; the last matches are kept")
            return None, f"profile route answered {response.status_code}"
        profile = response.json().get("approved")
        if not profile:
            return None, "no approved profile"
    if profile.get("status") != "approved" or problems(profile):
        raise SystemExit("the profile is not an approved, valid schema v1 profile")
    return profile, "approved"


def run(profile: dict | None, http=None, now: datetime | None = None, reason: str = "no approved profile") -> dict:
    now = now or datetime.now(timezone.utc)
    folder = store_dir()
    ads = load_ads(folder / "ads.json")
    path = folder / "matches.json"
    old = {r["id"]: r for r in json.loads(path.read_text(encoding="utf-8"))["matches"]} if path.exists() else {}
    note: dict = {"at": now.isoformat(timespec="seconds"), "neurons_before": round(ai.spent(), 2)}
    if profile is None:
        # Keep the last matches; the mart drops those of closed ads. Without any, dbt still needs a store.
        if path.exists():
            return {**json.loads(path.read_text(encoding="utf-8")), "kept": reason}
        result = {"profile": None, "engine": ENGINE, "note": {**note, "skipped": reason}, "matches": []}
        write_atomic(path, result)
        return result
    # A passed deadline ends an ad as removal does; the rule is mart_job_assistant_ads' `expired`.
    local = now.astimezone(LOCAL).strftime(STAMP)
    current = {k: a for k, a in ads.items() if not a.get("removed_at") and not a.get("duplicate_of")
               and not (a.get("application_deadline") or "9")[:19] < local}
    rows = {}
    for key, ad in current.items():
        before = old.get(key)
        if (before and before["engine"] == ENGINE and before["profile_version"] == profile["version"]
                and before["content_hash"] == ad["content_hash"]):
            rows[key] = before
        else:
            rows[key] = {**match(ad, profile), "content_hash": ad["content_hash"], "explanation": None}
    texts = {k: ai.ad_text(a) for k, a in current.items()}
    texts["__profile__"] = ai.profile_text(profile)
    vecs = ai.vectors(texts, http, note.setdefault("embeddings", {}))
    sims = ai.similarity({k: v for k, v in vecs.items() if k != "__profile__"}, vecs.get("__profile__"))
    for key, row in rows.items():
        row["similarity"] = sims.get(key)
    ranked = order(list(rows.values()), ads, profile, sims)
    today = now.date().isoformat()
    explained = sum(1 for r in rows.values() if (r.get("explanation") or {}).get("at", "")[:10] == today)
    note["explained"] = 0
    for row in ranked:
        if row["class"] not in LISTED or row.get("explanation"):
            continue
        try:
            result = ai.explain(row, ads[row["id"]], http, explained, now)
        except (RuntimeError, OSError) as error:
            note["explain_stopped"] = f"error: {type(error).__name__}"
            break
        if result is None:
            break
        row["explanation"] = result
        explained += 1
        note["explained"] += 1
    note["neurons_after"] = round(ai.spent(), 2)
    for position, row in enumerate(ranked, 1):
        row["rank"] = position
    result = {"profile": {"version": profile["version"], "cv_sha256": profile["cv"]["sha256"],
                          "profile_sha256": profile["profile_sha256"], "approved_at": profile["approved_at"]},
              "engine": ENGINE, "note": note, "matches": ranked}
    write_atomic(path, result)
    return result


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--profile", type=Path, help="an approved profile file instead of the Worker's")
    args = ap.parse_args()
    profile, reason = approved_profile(args.profile)
    result = run(profile, ai.session() if profile else None, reason=reason)
    classes = {}
    for row in result["matches"]:
        classes[row["class"]] = classes.get(row["class"], 0) + 1
    print(json.dumps({"profile": result["profile"] and result["profile"]["version"], "classes": classes,
                      "note": result["note"], "kept": result.get("kept")}, ensure_ascii=False))


if __name__ == "__main__":
    main()
