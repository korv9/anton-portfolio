"""Read-only semantic checks for jobs, news and DiVA before dataset publication."""
from __future__ import annotations

import argparse
import json
import math
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
from common import read_json  # noqa: E402

LOCAL = ZoneInfo("Europe/Stockholm")


def require(condition, message):
    if not condition:
        raise ValueError(message)


def finite(value, path="data"):
    if isinstance(value, float):
        require(math.isfinite(value), f"{path}: non-finite number")
    elif isinstance(value, dict):
        for key, child in value.items():
            finite(child, f"{path}.{key}")
    elif isinstance(value, list):
        for index, child in enumerate(value):
            finite(child, f"{path}[{index}]")


def count(value, path):
    require(type(value) is int and value >= 0, f"{path}: expected nonnegative integer count")


def counts(value, path):
    if isinstance(value, dict):
        for key, child in value.items():
            counts(child, f"{path}.{key}")
    else:
        count(value, path)


def yearly(values, years, path):
    require(isinstance(values, dict), f"{path}: expected year counts")
    for year, value in values.items():
        require(year in {str(y) for y in years}, f"{path}.{year}: unknown year")
        count(value, f"{path}.{year}")


def day(value, path):
    parsed = date.fromisoformat(value)
    require(parsed.isoformat() == value, f"{path}: expected YYYY-MM-DD")
    return parsed


def month(value, path):
    require(isinstance(value, str) and len(value) == 7, f"{path}: expected YYYY-MM")
    return day(value + "-01", path)


def timestamp(value, path, now):
    require(isinstance(value, str) and len(value) >= 19 and value[10] == "T",
            f"{path}: expected ISO timestamp with time")
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    require(parsed.tzinfo is not None, f"{path}: timestamp needs timezone")
    require(parsed <= now, f"{path}: future timestamp")
    return parsed


def unique(rows, key, path):
    values = [row[key] for row in rows]
    require(all(type(v) in (str, int) and v != "" for v in values), f"{path}: invalid identifier")
    require(len(values) == len(set(values)), f"{path}: duplicate {key}")


def subsets(fields, path):
    """Compare corresponding leaves only; fields may overlap and must not be summed."""
    total = fields.get("all", {})

    def compare(part, whole, location):
        for key in part.keys() & whole.keys():
            if isinstance(part[key], dict) and isinstance(whole[key], dict):
                compare(part[key], whole[key], f"{location}.{key}")
            else:
                require(part[key] <= whole[key], f"{location}.{key}: field exceeds all total")

    for field, values in fields.items():
        if field != "all":
            compare(values, total, f"{path}.{field}")


def series(fields, kind, today):
    require(isinstance(fields, dict), f"{kind}: expected field series")
    indexed = {}
    for field, rows in fields.items():
        previous = None
        indexed[field] = {}
        for row in rows:
            require(isinstance(row, list) and len(row) == 3, f"{kind}.{field}: expected [date, ads, vacancies]")
            when = month(row[0], kind) if kind == "monthly" else day(row[0], kind)
            bound = today.replace(day=1) if kind == "monthly" else today
            require(when < bound, f"{kind}.{field}.{row[0]}: incomplete or future period")
            require(previous is None or when > previous, f"{kind}.{field}: duplicate or unordered date")
            count(row[1], f"{kind}.{field}.{row[0]}.ads")
            count(row[2], f"{kind}.{field}.{row[0]}.vacancies")
            indexed[field][row[0]] = {"ads": row[1], "vacancies": row[2]}
            previous = when
    subsets(indexed, kind)
    return indexed


def stream_coverage(state, now):
    """State is persisted only after successful windows; zero-ad days need no rows."""
    finite(state, "stream_state")
    start = day(state["complete_from"], "stream_state.complete_from")
    value = state["fetched_until"]
    require(isinstance(value, str) and len(value) >= 19 and value[10] == "T",
            "stream_state.fetched_until: expected ISO timestamp with time")
    fetched = datetime.fromisoformat(value)
    # JobStream's ingestion state is Swedish local time without an offset.
    if fetched.tzinfo is None:
        fetched = fetched.replace(tzinfo=LOCAL)
    fetched = fetched.astimezone(LOCAL)
    local_now = now.astimezone(LOCAL)
    require(fetched <= local_now, "stream_state.fetched_until: future watermark")
    complete = fetched.date() - timedelta(days=1)
    yesterday = local_now.date() - timedelta(days=1)
    require(start <= yesterday <= complete, "stream_state: stale or incomplete coverage of yesterday")
    if "last_complete_day" in state:
        require(day(state["last_complete_day"], "last_complete_day") == complete,
                "stream_state.last_complete_day disagrees with fetched_until")
    return {"complete_from": start.isoformat(), "last_complete_day": complete.isoformat()}


def jobs(data, now, state=None):
    finite(data)
    timestamp(data["generated_at"], "generated_at", now)
    today = now.astimezone(LOCAL).date()
    monthly = series(data["monthly"], "monthly", today)
    require(bool(monthly.get("all")), "monthly.all: missing total series")
    last = max(monthly["all"])
    require(data["last_month"] == last, "last_month differs from last monthly.all row")
    latest = month(last, "last_month")
    require(type(data["latest_year"]) is int and data["latest_year"] == latest.year,
            "latest_year disagrees with last_month")
    require(type(data["ytd_months"]) is int and data["ytd_months"] == latest.month,
            "ytd_months disagrees with last_month")
    years = sorted({month(m, "monthly.all").year for m in monthly["all"]})
    require(all(type(y) is int for y in data["years"]) and data["years"] == years,
            "years differs from ordered unique monthly.all years")
    daily = series(data.get("daily", {}), "daily", today)
    unique(data["fields"], "id", "fields")
    for name, identity in (("occupations", "id"), ("regions", "region")):
        unique(data[name], identity, name)
        for row in data[name]:
            for metric in ("ads", "ytd"):
                counts(row[metric], f"{name}.{row[identity]}.{metric}")
                if name == "regions":
                    for field, values in row[metric].items():
                        yearly(values, years, f"regions.{row[identity]}.{metric}.{field}")
                    subsets(row[metric], f"regions.{row[identity]}.{metric}")
                else:
                    yearly(row[metric], years, f"occupations.{row[identity]}.{metric}")
            full = row["ads"] if name == "regions" else {"occupation": row["ads"]}
            partial = row["ytd"] if name == "regions" else {"occupation": row["ytd"]}
            for field, values in partial.items():
                for year in values.keys() & full.get(field, {}).keys():
                    require(values[year] <= full[field][year], f"{name}.{row[identity]}: ytd exceeds ads")
    counts(data["conditions"], "conditions")
    for year, fields in data["conditions"].items():
        require(year in {str(y) for y in years}, f"conditions.{year}: unknown year")
        subsets(fields, f"conditions.{year}")
    for archive in data["archives"]:
        count(archive["ads"], "archives.ads")
    for value in data.get("preliminary", []):
        require(value in monthly["all"], "preliminary month missing from monthly.all")
    result = {}
    if state is not None:
        result["stream_coverage"] = stream_coverage(state, now)
        for rows in daily.values():
            require(all(d <= result["stream_coverage"]["last_complete_day"] for d in rows),
                    "daily row exceeds stream coverage watermark")
    return result


def news(data, summary, now):
    finite(data)
    generated = timestamp(data["generated_at"], "generated_at", now)
    require(isinstance(data["sources"], dict), "news.sources: expected source mapping")
    unique(data["items"], "id", "news.items")
    by_id = {item["id"]: item for item in data["items"]}
    published = {}
    for item in data["items"]:
        require(item["source"] in data["sources"], f"news.{item['id']}: unknown source")
        published[item["id"]] = timestamp(item["published_at"], f"news.{item['id']}.published_at", now)
    result = {"warnings": []}
    if summary is None:
        return result
    finite(summary, "summary")
    written = timestamp(summary["generated_at"], "summary.generated_at", now)
    start = day(summary["period"]["from"], "summary.period.from")
    end = day(summary["period"]["to"], "summary.period.to")
    count(summary["period"]["days"], "summary.period.days")
    require(summary["period"]["days"] > 0 and start <= end <= written.date()
            and (end - start).days <= summary["period"]["days"], "summary: invalid period")
    for key in ("headline", "summary"):
        require(isinstance(summary[key], str) and summary[key].strip(), f"summary.{key}: empty text")
    require(bool(summary["themes"]), "summary.themes: missing grounded themes")
    # Export is bounded by both retention and item limit. Missing older IDs cannot be
    # disproved from this window; their archived grounding needs a separate audit.
    visible_start = min((p.date() for p in published.values()), default=generated.date())
    historical = start < visible_start and written < generated
    missing = set()
    for section in ("themes", "by_party"):
        for entry in summary[section]:
            require(isinstance(entry["text"], str) and entry["text"].strip(), f"summary.{section}: empty text")
            ids = entry["item_ids"]
            require(isinstance(ids, list) and ids and all(isinstance(i, str) and i for i in ids),
                    f"summary.{section}: missing citations")
            require(len(ids) == len(set(ids)), f"summary.{section}: duplicate citations")
            unknown = set(ids) - by_id.keys()
            require(not unknown or historical, f"summary.{section}: unknown current citation")
            missing.update(unknown)
            known = [i for i in ids if i in by_id]
            require(all(start <= published[i].date() <= end for i in known),
                    f"summary.{section}: citation outside original period")
            if section == "themes":
                tagged = {p for i in known for p in by_id[i].get("parties", [])}
                require(unknown or set(entry["parties"]) <= tagged, "summary.theme: ungrounded party")
            else:
                require(all(entry["party"] in by_id[i].get("parties", []) for i in known),
                        "summary.by_party: party not tagged in citation")
    if missing:
        result["warnings"].append(f"{len(missing)} older summary citations require archived-item verification")
    result["summary_period"] = summary["period"]
    return result


def diva(data):
    finite(data)
    unique(data["clusters"], "id", "diva.clusters")
    ids = {cluster["id"] for cluster in data["clusters"]}
    require(all(type(i) is int and i >= 0 for i in ids), "diva.clusters: invalid cluster id")
    for point in data["points"]:
        require(all(type(point[axis]) in (int, float) and math.isfinite(point[axis]) for axis in ("x", "y")),
                "diva.points: invalid coordinates")
        require(type(point["c"]) is int and point["c"] in ids, "diva.points: unknown cluster")
    return {"warnings": ["DiVA points have no record identifier; point uniqueness cannot be verified"]}


def validate_delivery(group, root, stream_state=None, now=None):
    now = now or datetime.now(timezone.utc)
    root = Path(root)
    if group == "jobs":
        state = read_json(stream_state) if stream_state else None
        return jobs(read_json(root / "jobs/market.json"), now, state)
    require(stream_state is None, "--stream-state applies only to jobs")
    if group == "news":
        summary_path = root / "parliament/news-summaries.json"
        summary = read_json(summary_path) if summary_path.exists() else None
        return news(read_json(root / "parliament/news.json"), summary, now)
    if group == "diva":
        return diva(read_json(root / "diva/clusters.json"))
    raise ValueError(f"Unknown group: {group}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--group", choices=("jobs", "news", "diva"), required=True)
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--stream-state", type=Path)
    args = parser.parse_args()
    try:
        details = validate_delivery(args.group, args.root, args.stream_state)
    except (OSError, ValueError, TypeError, KeyError, AttributeError, OverflowError) as exc:
        print(json.dumps({"group": args.group, "status": "failed", "error": str(exc)}))
        return 1
    print(json.dumps({"group": args.group, "status": "validated", **details}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
