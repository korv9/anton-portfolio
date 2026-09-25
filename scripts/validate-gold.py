"""Independent contract checks for the checked-in gold semantic model.

Sources that moved to object storage are fetched from the delivery base, so the
"source changed without a rebuild" guarantee still covers every input.
"""

import hashlib
import json
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import delivery
from common import GOLD, ROOT, portable_sha, read_json, sha_of


def read(path):
    return read_json(path)



def source_sha(item):
    """Hash a gold input, reading it from object storage when it is no longer local."""
    relative = item["path"].removeprefix("public/data/")
    return item, sha_of(delivery.read_bytes(relative))


def require(condition, message):
    if not condition:
        raise ValueError(message)


def main():
    model = read(GOLD / "semantic-model.json")
    require(model["model_id"] == "portfolio-gold-v1", "Unexpected model version")
    require(portable_sha(ROOT / model["builder"]["path"])
            == model["builder"]["sha256"], "Gold builder changed without a rebuild")
    with ThreadPoolExecutor(max_workers=16) as pool:
        for item, digest in pool.map(source_sha, model["source_files"]):
            require(digest == item["sha256"],
                    f"Source changed without rebuilding gold: {item['path']}")
    for relative, item in model["materializations"].items():
        path = GOLD / relative
        content = path.read_bytes()
        require(len(content) == item["bytes"] and hashlib.sha256(content).hexdigest() == item["sha256"],
                f"Gold materialization changed: {relative}")

    tables = {}
    for name, spec in model["tables"].items():
        rows = read(GOLD / spec["path"])
        require(len(rows) == spec["rows"], f"Wrong row count: {name}")
        keys = [tuple(row.get(field) for field in spec["primary_key"]) for row in rows]
        require(len(keys) == len(set(keys)), f"Duplicate primary key: {name}")
        require(all(all(value is not None and value != "" for value in key) for key in keys),
                f"Missing primary key: {name}")
        tables[name] = rows

    points = {row["point_id"]: row for row in tables["fact_decision_point"]}
    votes = defaultdict(list)
    for row in tables["fact_party_vote"]:
        require(row["point_id"] in points, f"Vote without decision point: {row['vote_id']}")
        require(points[row["point_id"]]["vote_id"] == row["vote_id"], "Vote-point mismatch")
        counts = {"Ja": row["yes_votes"], "Nej": row["no_votes"], "Avstår": row["abstain_votes"]}
        require(counts[row["party_position"]] == max(counts.values()), "Party position differs from member counts")
        require(row["cast_votes"] == sum(counts.values()), "Cast-vote total mismatch")
        votes[row["vote_id"]].append(row)
    party_codes = {row["party"] for row in tables["dim_party"] if row["in_imported_vote_sessions"]}
    require(len(votes) == 1436, "Unexpected imported vote coverage")
    require(all({row["party"] for row in rows} == party_codes and len(rows) == 8 for rows in votes.values()),
            "Not all eight parties represented in each imported vote")
    for name in ("fact_point_citation", "fact_point_reservation"):
        require(all(row["point_id"] in points for row in tables[name]), f"Orphaned {name}")
    require(all(row["vote_id"] in votes and row["party"] in party_codes for row in tables["fact_speech_vote_candidate"]),
            "Orphaned speech-vote candidate")
    require(all(row["vote_id"] in votes for row in tables["fact_motion_vote_link"]),
            "Motion linked to an unknown roll call")
    require(all(row["point_id"] in points and row["evidence_status"] == "document_level_only"
                for row in tables["fact_proposition_point_link"]),
            "Proposition link exceeds its verified evidence level")
    require(all(row["evidence_status"] == "lexical_candidate" and row["direction_eligible"] is False
                for row in tables["fact_law_mention_candidate"]),
            "Law mention improperly treated as validated direction")

    actors = {row["actor"] for row in tables["dim_actor"]}
    for row in tables["fact_budget_frame"]:
        require(row["actor"] in actors, "Unknown budget actor")
        require(row["amount_msek"] - row["government_amount_msek"] == row["deviation_msek"],
                "Budget amount/deviation mismatch")
    budget_by_key = {(row["session"], row["actor"], row["expenditure_area"]): row
                     for row in tables["fact_budget_frame"]}
    language_by_key = {(row["corpus"], row["method"], row["session"], row["party"], row["expenditure_area"]): row
                       for row in tables["fact_language_area"]}
    frame_areas = defaultdict(set)
    for row in tables["fact_budget_frame"]:
        frame_areas[(row["session"], row["actor"])].add(row["expenditure_area"])
    for row in tables["mart_budget_language_gap"]:
        budget_row = budget_by_key[(row["session"], row["party"], row["expenditure_area"])]
        language_row = language_by_key[(row["corpus"], row["method"], row["session"], row["party"], row["expenditure_area"])]
        require(frame_areas[(row["session"], row["party"])] == set(range(1, 28)),
                "Incomplete budget proposal leaked into comparison")
        require(row["budget_share_pct"] == budget_row["budget_share_pct"] and
                row["keyword_share_pct"] == language_row["keyword_share_pct"],
                "Budget-language measure differs from source facts")
        require(row["attention_minus_budget_pp"] == round(row["keyword_share_pct"] - row["budget_share_pct"], 4),
                "Budget-language difference calculated incorrectly")
    topics = {(row["model_id"], row["topic_id"]) for row in tables["dim_topic"]}
    for name in ("fact_topic_session_party", "fact_umap_sample"):
        require(all((row["model_id"], row["topic_id"]) in topics for row in tables[name]),
                f"Unknown topic model in {name}")
    laws = {(row["pool"], row["document_id"]): row["provision_count"] for row in tables["dim_law_snapshot"]}
    provision_counts = Counter((row["pool"], row["document_id"]) for row in tables["fact_law_provision"])
    require(laws == provision_counts, "Law provision counts do not match snapshot index")

    monthly = Counter()
    for row in tables["fact_job_month_role"]:
        monthly[(int(row["month"][:4]), row["role"])] += row["new_ads"]
    require(all(monthly[(row["year"], row["role"])] == row["ads"] for row in tables["fact_job_year_role"]),
            "Monthly and yearly job-ad counts disagree")

    overview = read(GOLD / "overview.json")
    for session in overview["sessions"]:
        mart = read(GOLD / session["path"])
        require(len(mart) == session["votes"], "Vote mart count differs from overview")
        for decision in mart:
            require(decision["point_id"] in points and decision["id"] in votes, "Vote mart key mismatch")
            require({item["party"]: item["party_position"] for item in decision["parties"]}
                    == {item["party"]: item["party_position"] for item in votes[decision["id"]]},
                    "Vote mart has a different party position from its fact table")
    require(model["metrics"]["validated_vote_direction_pairs"]["status"] == "unavailable", "Unsupported direction KPI exposed")
    print(f"Verified {len(tables)} tables, {len(votes)} roll calls, {len(model['source_files'])} source hashes and {len(model['materializations'])} gold files.")


if __name__ == "__main__":
    main()
