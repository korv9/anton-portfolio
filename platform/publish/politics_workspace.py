"""Compact, source-traceable political workspaces from existing delivered artifacts.

Runs offline without a warehouse. Full dbt builds produce the equivalent contextual marts;
the delivered party-count snapshot bounds the contextual coverage of this offline export. The parliament exporter passes its tested
warehouse connection to cover all available historical party counts.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import itertools
import json
from collections import defaultdict
from datetime import date
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parents[2]
PUBLIC = ROOT / "frontend/public/data"
SEEDS = ROOT / "platform/seeds/parliament"
POSITIONS = {"Ja": "yes", "Nej": "no", "Avstår": "abstain"}
COUNTS = ("yes", "no", "abstain", "absent")


def read(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def seed(name: str):
    with (SEEDS / f"{name}.csv").open(encoding="utf-8", newline="") as stream:
        return list(csv.DictReader(stream))


def write(path: Path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")


def position(counts: dict) -> str:
    values = [counts[k] for k in COUNTS[:3]]
    if sum(values) + counts["absent"] == 0:
        return "not_represented"
    if sum(values) == 0:
        return "absent"
    if sum(v > 0 for v in values) > 1:
        return "mixed"
    return COUNTS[values.index(max(values))]


def majority_position(counts: dict) -> str | None:
    values = [counts[k] for k in COUNTS[:3]]
    return COUNTS[values.index(max(values))] if max(values) > 0 and values.count(max(values)) == 1 else None


def government_at(governments: list[dict], day: str):
    matches = [g for g in governments if g["start_date"] <= day and (not g["end_date"] or day < g["end_date"])]
    if len(matches) > 1:
        raise ValueError(f"Overlapping government terms on {day}")
    return matches[0] if matches else None


def ballots(governments: list[dict], as_of: str) -> list[dict]:
    grouped = defaultdict(list)
    seen = set()
    for row in seed("prime_minister_party_votes"):
        key = (row["vote_key"], row["party"])
        if key in seen:
            raise ValueError(f"Duplicate ballot party {key}")
        seen.add(key)
        counts = {k: int(row[k]) for k in COUNTS}
        if any(v < 0 for v in counts.values()):
            raise ValueError("Negative ballot count")
        grouped[row["vote_key"]].append({"party": row["party"], "source_party": row["source_party"], **counts, "position": position(counts), "members": sum(counts.values())})
    result = []
    for row in seed("prime_minister_ballots"):
        if row["vote_key"] > as_of:
            continue
        parties = grouped[row["vote_key"]]
        totals = {k: sum(p[k] for p in parties) for k in COUNTS}
        if sum(totals.values()) != 349 or any(totals[k] != int(row["recorded_" + k]) for k in COUNTS):
            raise ValueError(f"Ballot totals disagree {row['vote_key']}")
        formed = next((g for g in governments if g["government_key"] == row["formed_government_key"]), None)
        if formed and (formed["start_date"] < row["vote_key"] or totals["no"] >= 175):
            raise ValueError("Invalid ballot-to-government relationship")
        result.append({**row, "date": row["vote_key"], "session": f"{int(row['vote_key'][:4]) - (int(row['vote_key'][5:7]) < 9)}/{str(int(row['vote_key'][:4]) + (int(row['vote_key'][5:7]) >= 9))[-2:]}", "totals": totals, "approved": totals["no"] < 175, "parties": parties, "formed_government": formed})
    return result


def contexts(votes: list[dict], party_rows: list[dict], governments: list[dict]):
    by_vote = {(v["session"], v["roll_call_id"]): v for v in votes}
    if len(by_vote) != len(votes):
        raise ValueError("Duplicate roll-call key")
    grouped = defaultdict(list)
    seen = set()
    for row in party_rows:
        key = (row["session"], row["vote_id"], row["party"])
        if key in seen:
            raise ValueError(f"Duplicate party-vote key {key}")
        seen.add(key)
        vote = by_vote.get(key[:2])
        if vote is None:
            continue
        counts = {c: row[c + "_votes"] for c in COUNTS}
        if any(v is None or v < 0 for v in counts.values()):
            raise ValueError("Missing or negative member vote count")
        grouped[key[:2]].append({"party": row["party"], **counts, "position": majority_position(counts)})
    pairs = defaultdict(lambda: {"compared": 0, "same": 0})
    cohesion = defaultdict(lambda: {k: 0 for k in ("roll_calls", "eligible", "present", "abstain_votes", "comparable_cast", "aligned_cast", "mixed_roll_calls", "pm_compared", "pm_same")})
    for key, rows in grouped.items():
        vote = by_vote[key]
        gov = government_at(governments, vote["vote_date"])
        gov_key = gov["government_key"] if gov else None
        prefix = (vote["session"], gov_key, vote["issue_key"])
        comparable = sorted((r for r in rows if r["position"]), key=lambda r: r["party"])
        for a, b in itertools.combinations(comparable, 2):
            entry = pairs[(*prefix, a["party"], b["party"])]
            entry["compared"] += 1
            entry["same"] += a["position"] == b["position"]
        pm = next((r["position"] for r in rows if gov and r["party"] == gov["prime_minister_party"]), None)
        for row in rows:
            entry = cohesion[(*prefix, row["party"])]
            present = sum(row[k] for k in COUNTS[:3])
            entry["roll_calls"] += 1
            entry["eligible"] += present + row["absent"]
            entry["present"] += present
            entry["abstain_votes"] += row["abstain"]
            entry["mixed_roll_calls"] += sum(row[k] > 0 for k in COUNTS[:3]) > 1
            if row["position"]:
                entry["comparable_cast"] += present
                entry["aligned_cast"] += max(row[k] for k in COUNTS[:3])
            if row["position"] in ("yes", "no") and pm in ("yes", "no"):
                entry["pm_compared"] += 1
                entry["pm_same"] += row["position"] == pm
        vote["parties"] = rows
    pair_rows = [dict(zip(("session", "government_key", "issue_key", "party_a", "party_b"), key), **value) for key, value in sorted(pairs.items(), key=lambda item: tuple(str(v or "") for v in item[0]))]
    records = [dict(zip(("session", "government_key", "issue_key", "party"), key), **value) for key, value in sorted(cohesion.items(), key=lambda item: tuple(str(v or "") for v in item[0]))]
    return pair_rows, records, sorted({key[0] for key in grouped})


def build(public: Path = PUBLIC, out: Path | None = None, as_of: str | None = None, warehouse=None):
    as_of = as_of or date.today().isoformat()
    out = out or public / "parliament/workspace"
    governments = []
    for row in seed("governments"):
        if row["start_date"] > as_of:
            continue
        governments.append({**row, "government_parties": row["government_parties"].split("|"), "agreement_parties": row["agreement_parties"].split("|") if row["agreement_parties"] else [], "is_current": row["start_date"] <= as_of and (not row["end_date"] or as_of < row["end_date"])})
    connection = duckdb.connect()
    cursor = connection.execute("select * from read_parquet(?) where is_substantive and vote_date <= ? order by session, vote_date, roll_call_id", [(public / "parquet/parliament_roll_calls/part-0.parquet").as_posix(), as_of])
    columns = [c[0] for c in cursor.description]
    votes = [{k: v.isoformat() if hasattr(v, "isoformat") else v for k, v in zip(columns, row)} for row in cursor.fetchall()]
    if warehouse is None:
        party_rows = read(public / "gold/tables/fact_party_vote.json")
    else:
        cursor = warehouse.execute("""select session, roll_call_id as vote_id, party,
            yes as yes_votes, no as no_votes, abstain as abstain_votes, absent as absent_votes
            from gold.fct_party_roll_call where is_substantive and vote_date <= ?
            order by session, roll_call_id, party""", [as_of])
        party_rows = [dict(zip([c[0] for c in cursor.description], row)) for row in cursor.fetchall()]
    connection.close()
    pairs, records, covered = contexts(votes, party_rows, governments)
    point_rows = read(public / "gold/tables/fact_decision_point.json")
    point_ids = defaultdict(set)
    for point in point_rows:
        if point.get("vote_id"):
            point_ids[(point["session"], point["vote_id"])].add(point["point_id"])
    bills = defaultdict(list)
    for link in read(public / "gold/tables/fact_proposition_point_link.json"):
        bills[link["point_id"]].append({"reference": link["proposition_reference"], "title": link["proposition_title"], "url": link["proposition_url"], "evidence": "document_level_citation"})
    candidates = defaultdict(list)
    for link in read(public / "gold/tables/fact_speech_vote_candidate.json"):
        candidates[link["vote_id"]].append({"speech_id": link["speech_id"], "url": link["speech_url"], "similarity": link["cosine_similarity"], "evidence": "semantic_candidate"})
    law_studies = {law["bill"]: law["studies"] for law in read(public / "parliament/studies.json")["recent_laws"]}
    for vote in votes:
        points = point_ids[(vote["session"], vote["roll_call_id"])]
        linked = bills[next(iter(points))] if len(points) == 1 else []
        unique_bills = {b["url"]: b for b in linked}
        named_studies = {s["url"]: s for b in unique_bills.values() for s in law_studies.get(b["reference"], [])}
        vote["links"] = {"bills": list(unique_bills.values()), "studies": list(named_studies.values()), "speech_candidates": sorted(candidates[vote["roll_call_id"]], key=lambda r: -r["similarity"])[:3]}
    issues = read(public / "parliament/issues.json")
    sessions = read(public / "parliament/sessions.json")
    all_ballots = ballots(governments, as_of)
    debate_activity = []
    debate_index = read(public / "politics/parliament/debate-stats/index.json")
    for item in debate_index["sessions"]:
        totals = defaultdict(lambda: {"speeches": 0, "replies": 0, "debates": 0})
        for debate in read(public / item["path"])["debates"]:
            if debate["date"] > as_of:
                continue
            for party, (opening, replies) in debate["parties"].items():
                totals[party]["speeches"] += opening + replies
                totals[party]["replies"] += replies
                totals[party]["debates"] += 1
        debate_activity.extend({"session": item["session"], "party": party, **counts} for party, counts in sorted(totals.items()))
    for vote in votes:
        vote["source_complete"] = all(vote[c] is not None for c in COUNTS) and sum(vote[c] or 0 for c in COUNTS) == 349
    sources = ["gold/tables/fact_decision_point.json", "gold/tables/fact_proposition_point_link.json", "gold/tables/fact_speech_vote_candidate.json", "parliament/studies.json", "politics/parliament/debate-stats/index.json", *[s["path"] for s in debate_index["sessions"]], "parquet/parliament_roll_calls/part-0.parquet", "gold/tables/fact_party_vote.json", "parliament/sessions.json", "parliament/issues.json"]
    provenance = {p: hashlib.sha256((public / p).read_bytes()).hexdigest() for p in sources}
    provenance.update({"seeds/parliament/" + p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in (SEEDS / (name + ".csv") for name in ("governments", "prime_minister_ballots", "prime_minister_party_votes"))})
    provenance["party_counts_used"] = hashlib.sha256(json.dumps(party_rows, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    if warehouse is not None:
        provenance.pop("gold/tables/fact_party_vote.json")
    coverage_counts = defaultdict(int)
    for vote in votes:
        government = government_at(governments, vote["vote_date"])
        coverage_counts[(vote["session"], government["government_key"] if government else None, vote["issue_key"])] += 1
    decision_coverage = [dict(zip(("session", "government_key", "issue_key"), key), roll_calls=count)
                         for key, count in sorted(coverage_counts.items(), key=lambda item: tuple(str(v or "") for v in item[0]))]
    result = {"schema_version": 1, "as_of": as_of, "source_sha256": provenance, "governments": governments, "ballots": all_ballots,
              "pairs": pairs, "cohesion": records, "decision_coverage": decision_coverage, "context_sessions": covered, "context_source": "gold.fct_party_roll_call" if warehouse is not None else "delivered fact_party_vote snapshot",
              "issues": [{k: row[k] for k in ("issue_key", "issue_name_en", "issue_name_sv", "committees", "expenditure_areas")} for row in issues["issues"]],
              "sessions": sessions["sessions"], "party_pairs": sessions["party_pairs"], "party_record": sessions["party_record"], "debate_activity": debate_activity,
              "coverage": {"ballots_from": "2014-10-02", "ballots_to": all_ballots[-1]["date"], "ballots_note": "Verified selected appointment ballots and the 2018 incumbent check. Earlier ballots are not digitized here; no no-confidence motions are included. No claim of exhaustive coverage after 2022.", "context_note": "Issue and government-period pairs require delivered party counts. Historical session pairs use the existing mart. Abstention is a comparable position; tied, absent-only and missing positions are excluded. Mixed counts with a unique plurality retain that position.", "government_note": "Agreement names are seed-level term context, not dated proof of support. Session-start government labels are not used for vote-date joins."}}
    write(out / "index.json", result)
    by_session = defaultdict(list)
    for vote in votes:
        gov = government_at(governments, vote["vote_date"])
        by_session[vote["session"]].append({**vote, "government_key": gov["government_key"] if gov else None})
    for session, rows in by_session.items():
        write(out / "decisions" / (session.replace("/", "-") + ".json"), rows)
    print(f"Political workspace: {len(votes)} substantive roll calls, {len(pairs)} contextual pairs, {len(all_ballots)} official ballots; context sessions {covered}")
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--as-of", default=date.today().isoformat())
    parser.add_argument("--public", type=Path, default=PUBLIC)
    parser.add_argument("--out", type=Path)
    args = parser.parse_args()
    build(args.public, args.out, args.as_of)
