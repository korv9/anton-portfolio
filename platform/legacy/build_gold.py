"""Build the static, versioned semantic layer from checked-in source exports.

No network access, model calls, or inferred political positions are involved.
Run ``python platform/legacy/build_gold.py`` after the upstream export builders.

Not dbt: the gold tables written here are built in Python from delivered JSON and CSV, outside
the dbt DAG. The tables in DBT_TABLES, the vote marts and the model's metrics and relationships
are dbt's (publish/export_politics.py); this build carries their entries forward unchanged.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))

import common
import gold_contract
import delivery
import csv
import hashlib
import io
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "frontend/public/data"
GOLD = SOURCE / "gold"
PARTIES = ("C", "KD", "L", "M", "MP", "S", "SD", "V")
HISTORICAL_PARTIES = ("NYD",)
# Built by dbt and delivered by publish/export_politics.py; see main().
DBT_TABLES = ("mart_party_session_vote", "mart_party_agreement", "fact_language_area",
              "fact_language_coverage", "mart_budget_language_gap", "fact_topic_session_party",
              "fact_activity", "fact_budget_outturn", "fact_rfc_version")
DBT_PATHS = ("marts/votes/", *(f"tables/{name}.json" for name in DBT_TABLES))
PARTY_NAMES = {
    "C": "Centerpartiet", "KD": "Kristdemokraterna", "L": "Liberalerna",
    "M": "Moderaterna", "MP": "Miljöpartiet", "S": "Socialdemokraterna",
    "SD": "Sverigedemokraterna", "V": "Vänsterpartiet", "NYD": "Ny demokrati",
}
MODEL_ID = "portfolio-gold-v1"
LEGACY_TOPIC_MODEL = "debates-legacy"
PARLIAMENT_TOPIC_MODEL = "parliament-current"
source_hashes = {}
outputs = {}


def portable_sha_of(content):
    # Git may check out source JSON/CSV with CRLF on Windows; hash logical text.
    return hashlib.sha256(content.replace(b"\r\n", b"\n")).hexdigest()


def portable_sha(path):
    return portable_sha_of(Path(path).read_bytes())


def source(path):
    """Read a build input, from disk or from object storage, and record its hash.

    Inputs that moved to object storage must still be hashed, or the "source changed
    without a rebuild" guarantee quietly stops covering them.
    """
    path = Path(path)
    relative = path.relative_to(ROOT).as_posix()
    content = (path.read_bytes() if path.is_file()
               else delivery.read_bytes(relative.removeprefix("frontend/public/data/")))
    source_hashes[relative] = portable_sha_of(content)
    text = content.decode("utf-8-sig")
    if path.suffix == ".csv":
        return list(csv.DictReader(io.StringIO(text), dialect="excel"))
    return json.loads(text)


def rows(path):
    data = source(path)
    return data.get("data", data) if isinstance(data, dict) else data


def source_glob(pattern):
    """Rows from every delivered file matching the pattern, local or remote."""
    return [row for relative in delivery.catalogue_paths(pattern)
            for row in rows(SOURCE / relative)]


def emit(relative, data):
    path = GOLD / relative
    content = gold_contract.payload(data)
    common.write_bytes_retrying(path, content)
    outputs[relative] = gold_contract.fingerprint(content)


def unique(records, fields, label):
    values = [tuple(record.get(field) for field in fields) for record in records]
    if len(values) != len(set(values)):
        duplicates = [key for key, n in Counter(values).items() if n > 1]
        raise ValueError(f"Duplicate {label} key {fields}: {duplicates[:3]}")
    if any(any(value is None or value == "" for value in key) for key in values):
        raise ValueError(f"Missing {label} key {fields}")


def position(row):
    choices = {"Ja": row["yes_votes"], "Nej": row["no_votes"], "Avstår": row["abstain_votes"]}
    highest = max(choices.values())
    winners = [label for label, count in choices.items() if count == highest]
    if highest == 0 or len(winners) != 1:
        raise ValueError(f"Missing or tied party position: {row['vote_id']} / {row['party']}")
    label = winners[0]
    if row["party_position"] in ("Ja", "Nej") and row["party_position"] != label:
        raise ValueError(f"Recorded position differs from counts: {row['vote_id']} / {row['party']}")
    return label


def table(name, records, grain, primary_key, join_columns, source_note, limitations=""):
    unique(records, primary_key, name)
    relative = f"tables/{name}.json"
    emit(relative, records)
    return gold_contract.describe(name, records, grain, primary_key, join_columns, source_note,
                                  limitations, (GOLD / relative).read_bytes())


percentage = gold_contract.percentage


def main():
    source_hashes.clear()
    outputs.clear()
    model_tables = {}

    points = source_glob("politics/parliament/sessions/*/decisions/*/points.json")
    votes_raw = source_glob("politics/parliament/sessions/*/votes.json")
    citations = source_glob("politics/parliament/sessions/*/decisions/*/citations.json")
    reservations = source_glob("politics/parliament/sessions/*/decisions/*/reservations.json")
    speech_links = source_glob("politics/parliament/sessions/*/decision-speech-links.json")
    motion_links = source_glob("politics/parliament/sessions/*/decision-motions.json")
    proposition_links = rows(SOURCE / "politics/parliament/legislative/proposition-committee-links.json")
    law_mentions = rows(SOURCE / "politics/parliament/laws/mentions.json")
    activities = rows(SOURCE / "politics/parliament/activities/summary.json")
    # Read for their source hashes: dbt builds the vote marts from these indexes, and the
    # model's source list must still show when they change.
    decision_indexes = [
        (path.parent.name, rows(path))
        for path in sorted(SOURCE.glob("politics/decisions/*/index.json"))
    ]
    budget = rows(SOURCE / "debates/budgets/summary.json")
    # Read for its source hash only: dbt builds fact_budget_outturn from it now.
    rows(SOURCE / "politics/parliament/budgets/outturn-areas.json")
    budget_alignment = rows(SOURCE / "debates/budgets/speech-alignment.json")
    budget_coverage = source(SOURCE / "debates/budgets/coverage.json")
    budget_speech = rows(SOURCE / "debates/budgets/speech-keywords-all-parties.json")
    language = source(SOURCE / "reports/budget-language.json")
    jobs_month = source(SOURCE / "jobs/03_ads_by_month.csv")
    jobs_year = source(SOURCE / "jobs/02_ads_by_year_role.csv")
    jobs_junior = source(SOURCE / "jobs/05_junior_by_month.csv")
    jobs_technology = source(SOURCE / "jobs/06_top_technologies.csv")
    jobs_overview = source(SOURCE / "jobs/01_overview.csv")
    topics = {
        LEGACY_TOPIC_MODEL: rows(SOURCE / "debates/summary.json"),
        PARLIAMENT_TOPIC_MODEL: rows(SOURCE / "politics/parliament/topics/summary.json"),
    }
    debate_overview = rows(SOURCE / "debates/overview.json")
    topic_session = [
        {**row, "model_id": model_id}
        for model_id, pattern in (
            (LEGACY_TOPIC_MODEL, "debates/sessions/*/topics.json"),
            (PARLIAMENT_TOPIC_MODEL, "politics/parliament/sessions/*/topics.json"),
        )
        for row in source_glob(pattern)
    ]
    umap = [
        {**row, "model_id": model_id}
        for model_id, pattern in (
            (LEGACY_TOPIC_MODEL, "debates/sessions/*/umap.json"),
            (PARLIAMENT_TOPIC_MODEL, "politics/parliament/sessions/*/umap.json"),
        )
        for row in source_glob(pattern)
    ]
    laws = rows(SOURCE / "politics/laws/index.json")
    provisions = [
        {"pool": pool, "document_id": row["document_id"], "provision_id": row["provision_id"],
         "label": row.get("label"), "chapter": row.get("chapter"),
         "kind": row.get("kind")}
        for pool in ("v1", "v2")
        for row in source_glob(f"politics/laws/{pool}/*.json")
    ]
    rfc = source(SOURCE / "reports/rfc-drift.json")
    overview = source(SOURCE / "politics/overview.json")

    point_by_id = {row["point_id"]: row for row in points}
    if len(point_by_id) != len(points):
        raise ValueError("point_id is not unique")
    point_by_vote = {row["vote_id"]: row for row in points if row.get("vote_id")}
    if len(point_by_vote) != sum(bool(row.get("vote_id")) for row in points):
        raise ValueError("vote_id maps to more than one decision point")
    vote_ids = {row["vote_id"] for row in votes_raw}
    if vote_ids != set(point_by_vote):
        raise ValueError("Votes without decision points, or decision points without imported vote rows")
    grouped_votes = defaultdict(list)
    for row in votes_raw:
        grouped_votes[row["vote_id"]].append(row)
    if any({row["party"] for row in group} != set(PARTIES) or len(group) != 8 for group in grouped_votes.values()):
        raise ValueError("Every imported vote must have exactly eight distinct party rows")
    if any(row["point_id"] not in point_by_id for row in citations + reservations):
        raise ValueError("Orphaned point citation or reservation")
    if any(row["vote_id"] not in vote_ids for row in speech_links):
        raise ValueError("Orphaned semantic speech candidate")
    if any(row["vote_id"] not in vote_ids for row in motion_links):
        raise ValueError("Motion linked to an unknown roll call")
    if any(row["point_id"] not in point_by_id for row in proposition_links):
        raise ValueError("Proposition linked to an unknown decision point")

    party_rows = [
        {**{field: row[field] for field in ("vote_id", "session", "party", "vote_date", "yes_votes", "no_votes", "abstain_votes", "absent_votes")},
         "point_id": point_by_vote[row["vote_id"]]["point_id"],
         "party_position": position(row),
         "cast_votes": row["yes_votes"] + row["no_votes"] + row["abstain_votes"]}
        for row in votes_raw
    ]
    sessions = sorted({row["session"] for row in points + budget + language["rows"] + topic_session})
    party_dim = [{"party": code, "name_sv": PARTY_NAMES[code],
                  "in_imported_vote_sessions": code in PARTIES}
                 for code in (*PARTIES, *HISTORICAL_PARTIES)]
    actor_dim = [{"actor": "GOV", "actor_type": "government", "party": None}] + [
        {"actor": code, "actor_type": "party_motion", "party": code} for code in PARTIES
    ]
    session_dim = [{"session": session, "start_year": int(session[:4]),
                    "end_year": int(session[:4]) + 1} for session in sessions]
    area_dim = []
    for area in range(1, 28):
        observed = sorted((row for row in budget if row["expenditure_area"] == area),
                          key=lambda row: row["budget_year"])
        if not observed:
            raise ValueError(f"Missing expenditure area {area}")
        area_dim.append({"expenditure_area": area,
                         "latest_name_sv": observed[-1]["expenditure_area_name"],
                         "historical_names_vary": len({row["expenditure_area_name"] for row in observed}) > 1})
    role_dim = [{"role": role} for role in sorted({row["role"] for row in jobs_month})]
    topic_dim = [{"model_id": model_id, **row} for model_id, group in topics.items() for row in group]
    law_dim = [{"pool": row["pool"], "document_id": row["id"], "title": row["title"],
                "version": row["version"], "provision_count": row["provisions"],
                "detail_path": "/data/politics/" + row["path"]} for row in laws]

    model_tables["dim_party"] = table("dim_party", party_dim, "One parliamentary party", ["party"], [], "Controlled eight-party code list")
    model_tables["dim_actor"] = table("dim_actor", actor_dim, "One budget proposer", ["actor"], ["party"], "GOV is a collective government proposal, not an individual party")
    model_tables["dim_session"] = table("dim_session", session_dim, "One parliamentary session", ["session"], [], "Union of observed report sessions")
    model_tables["dim_expenditure_area"] = table("dim_expenditure_area", area_dim, "One current area code", ["expenditure_area"], [], "Corrected budget export", "Historical area names and definitions may change; fact rows preserve source names")
    model_tables["dim_role"] = table("dim_role", role_dim, "One job-role family", ["role"], [], "Job-market role labels")
    model_tables["dim_topic"] = table("dim_topic", topic_dim, "One topic in one model run", ["model_id", "topic_id"], [], "Two independent topic models", "Never join on topic_id alone")
    model_tables["dim_law_snapshot"] = table("dim_law_snapshot", law_dim, "One parsed statute snapshot in one pool", ["pool", "document_id"], [], "Allegoria parsed provision index", "v1 and v2 overlap; not verified effective law at speech date")

    point_facts = [{**{field: row.get(field) for field in ("point_id", "session", "document_id", "designation", "point", "title", "point_heading", "decision_type", "vote_id", "decision_date", "source_url", "motion_count", "proposition_count", "reservation_count")},
                    "committee": re.sub(r"\d+$", "", row["designation"])} for row in points]
    model_tables["fact_decision_point"] = table("fact_decision_point", point_facts, "One committee decision point", ["point_id"], ["session", "vote_id"], "Parliament decision export")
    model_tables["fact_party_vote"] = table("fact_party_vote", party_rows, "One party in one imported roll call", ["vote_id", "party"], ["point_id", "session", "party"], "Parliament vote export; modal position derived from member counts", "Ja means yes to the committee proposal, not every cited bill")
    for name, records, label, fields in (
        ("fact_point_citation", citations, "citation_id", ("point_id", "document_id", "document_type", "document_reference", "claim_number", "claim_scope", "document_url", "link_evidence")),
        ("fact_point_reservation", reservations, "reservation_id", ("point_id", "party", "reservation_number", "proposal_type", "heading", "vote_id", "source_url")),
    ):
        counters = defaultdict(int)
        result = []
        for row in records:
            counters[row["point_id"]] += 1
            result.append({label: f"{row['point_id']}:{counters[row['point_id']]:04d}",
                           **{field: row.get(field) for field in fields}})
        model_tables[name] = table(name, result, "One documented point reference", [label], ["point_id"], "Parliament decision export", "A citation does not establish support")
    candidate_rows = [
        {**{field: row.get(field) for field in ("vote_id", "party", "speech_id", "cosine_similarity", "same_member", "speaker_vote", "decision_url", "speech_url")},
         "evidence_status": "semantic_candidate"}
        for row in speech_links
    ]
    model_tables["fact_speech_vote_candidate"] = table("fact_speech_vote_candidate", candidate_rows, "One retrieved speech–vote candidate", ["vote_id", "party", "speech_id"], ["vote_id", "party", "speech_id"], "Parliament semantic retrieval export", "Similarity is not a stance or truthfulness judgment")
    model_tables["fact_motion_vote_link"] = table("fact_motion_vote_link", motion_links, "One cited motion per roll call", ["vote_id", "motion_id"], ["vote_id"], "Parliament motion-vote export", "A citation is not the outcome of the individual motion")
    proposition_facts = [{**row, "evidence_status": "document_level_only"} for row in proposition_links]
    model_tables["fact_proposition_point_link"] = table("fact_proposition_point_link", proposition_facts, "One proposition cited at a decision point", ["point_id", "proposition_id"], ["point_id"], "Explicit committee document citation", "No claim-level or enacted-provision link")
    law_mention_facts = [{**row, "evidence_status": "lexical_candidate"} for row in law_mentions]
    model_tables["fact_law_mention_candidate"] = table("fact_law_mention_candidate", law_mention_facts, "One speech and named law candidate", ["speech_id", "sfs_document_id"], ["speech_id"], "Lexical law-name matching", "Snapshot not verified effective at speech date; provision and direction unresolved")
    model_tables["fact_budget_frame"] = table("fact_budget_frame", budget, "One session, proposer and area", ["session", "actor", "expenditure_area"], ["session", "actor", "expenditure_area"], "Corrected exact-year budget frame", "Incomplete years and missing party proposals must not be imputed")
    budget_groups = defaultdict(set)
    for row in budget:
        budget_groups[(row["session"], row["actor"])].add(row["expenditure_area"])
    complete_frames = {key for key, areas in budget_groups.items()
                       if key[1] in PARTIES and areas == set(range(1, 28))}
    job_month = [{**row, "new_ads": int(row["new_ads"]), "unique_employers": int(row["unique_employers"])} for row in jobs_month]
    job_year = [{**row, "year": int(row["year"]), "ads": int(row["ads"]), "unique_employers": int(row["unique_employers"])} for row in jobs_year]
    job_junior = [{**row, "junior_ads": int(row["junior_ads"]), "total_ads": int(row["total_ads"]), "junior_share_pct": float(row["junior_share_pct"])} for row in jobs_junior]
    job_technology = [{**row, "ads_mentioning": int(row["ads_mentioning"]), "share_pct": float(row["share_pct"])} for row in jobs_technology]
    model_tables["fact_job_month_role"] = table("fact_job_month_role", job_month, "One month and role", ["month", "role"], ["role"], "JobTech historical-ad aggregate", "Ads are not hires")
    model_tables["fact_job_year_role"] = table("fact_job_year_role", job_year, "One year and role", ["year", "role"], ["role"], "JobTech historical-ad aggregate", "Annual distinct-ad counts; do not sum employer counts across months")
    model_tables["fact_job_junior_month"] = table("fact_job_junior_month", job_junior, "One month and role with junior data", ["month", "role"], ["role"], "JobTech title-rule aggregate", "Absent rows are missing, not zero")
    model_tables["fact_job_technology"] = table("fact_job_technology", job_technology, "One cohort and technology", ["cohort", "technology"], [], "JobTech mention aggregate", "A mention may be optional or negated")
    umap_facts = [{field: row.get(field) for field in ("model_id", "chunk_id", "speech_id", "topic_id", "x", "y", "party", "session", "speech_date", "source_url", "session_population")} for row in umap]
    model_tables["fact_umap_sample"] = table("fact_umap_sample", umap_facts, "One sampled text segment in a model run", ["model_id", "chunk_id"], ["model_id", "topic_id", "session", "party", "speech_id"], "Deterministic UMAP export", "Sample coordinates are not comparable across model runs or ideological positions")
    model_tables["fact_law_provision"] = table("fact_law_provision", provisions, "One parsed provision in a snapshot", ["pool", "document_id", "provision_id"], ["pool", "document_id"], "Allegoria provision snapshots", "Metadata only; full text remains in versioned source shard")

    if any(row["party"] not in PARTY_NAMES for row in party_rows + language["rows"] + activities + topic_session + umap):
        raise ValueError("Unknown party in a party-grain fact")
    if any(row["actor"] not in {actor["actor"] for actor in actor_dim} for row in budget):
        raise ValueError("Unknown budget actor")
    if any(row["role"] not in {role["role"] for role in role_dim} for row in job_year + job_junior):
        raise ValueError("Unknown job role outside the monthly role dimension")
    if any(row["session"] not in sessions for row in activities + umap):
        raise ValueError("Unknown session outside the session dimension")
    if any((row["model_id"], row["topic_id"]) not in {(t["model_id"], t["topic_id"]) for t in topic_dim} for row in topic_session + umap):
        raise ValueError("Unknown topic/model pair")
    if any((row["pool"], row["document_id"]) not in {(law["pool"], law["document_id"]) for law in law_dim} for row in provisions):
        raise ValueError("Provision without a law snapshot")

    emit("marts/budget-report.json", {
        "budgets": budget, "alignment": budget_alignment, "coverage": budget_coverage,
        "speech_rows": budget_speech, "language": language,
    })
    # Headline figures are derived from the yearly and junior tables, so a new year of data
    # moves them without a contract change. Baseline is the first year, comparison the last.
    job_metrics = {row["metric"]: float(row["value"]) for row in jobs_overview}
    job_years = sorted({row["year"] for row in job_year})
    baseline_year, comparison_year = job_years[0], job_years[-1]
    ads_by_role_year = defaultdict(int)
    for row in job_year:
        ads_by_role_year[row["role"], row["year"]] += row["ads"]
    junior_by_role_year = defaultdict(int)
    for row in job_junior:
        junior_by_role_year[row["role"], int(row["month"][:4])] += row["junior_ads"]

    def change_pct(before, after):
        return round(100 * (after - before) / before, 1) if before else None

    software = ("Software Developer", baseline_year), ("Software Developer", comparison_year)
    job_kpis = {
        "baseline_year": baseline_year,
        "comparison_year": comparison_year,
        "ads_total": sum(row["ads"] for row in job_year),
        "employers_unique": job_metrics["Unique employers"],
        "software_baseline": ads_by_role_year[software[0]],
        "software_comparison": ads_by_role_year[software[1]],
        "software_change_pct": change_pct(ads_by_role_year[software[0]], ads_by_role_year[software[1]]),
        "junior_share_pct": round(100 * sum(r["junior_ads"] for r in job_junior)
                                  / sum(r["total_ads"] for r in job_junior), 1),
        "junior_software_baseline": junior_by_role_year[software[0]],
        "junior_software_comparison": junior_by_role_year[software[1]],
        "junior_software_change_pct": change_pct(junior_by_role_year[software[0]],
                                                 junior_by_role_year[software[1]]),
    }
    # Roles ordered by volume, largest first, so the default selection is the largest role.
    role_totals = defaultdict(int)
    for row in job_year:
        role_totals[row["role"]] += row["ads"]
    emit("marts/jobs.json", {"years": job_years,
                              "roles": sorted(role_totals, key=lambda role: (-role_totals[role], role)),
                              "monthly": job_month, "yearly": job_year,
                              "junior": job_junior, "technologies": job_technology,
                              "overview": jobs_overview, "kpis": job_kpis})
    umap_sessions = []
    for path in sorted(SOURCE.glob("debates/sessions/*/umap.json")):
        slug = path.parent.name
        umap_sessions.append(slug)
        emit(f"marts/debate/{slug}.json", {"model_id": LEGACY_TOPIC_MODEL, "data": rows(path)})
    # The sessions that have a map, so the site offers exactly those.
    emit("marts/debate/topics.json", {"model_id": LEGACY_TOPIC_MODEL, "sessions": umap_sessions,
                                      "overview": debate_overview, "data": topics[LEGACY_TOPIC_MODEL]})
    emit("marts/rfc-drift.json", rfc)
    # The vote marts themselves are built by dbt (models/gold/politics/mart_vote_decisions).
    gold_overview = {**overview, "sessions": [
        {**item, "path": f"marts/votes/{item['slug']}.json"} for item in overview["sessions"]
    ], "model_id": MODEL_ID}
    emit("overview.json", gold_overview)

    # Files that moved to dbt keep their model entries: publish/export_politics.py writes and
    # registers them, and this build carries its entries forward unchanged.
    previous = common.read_json(GOLD / "semantic-model.json")
    for name in DBT_TABLES:
        model_tables[name] = previous["tables"][name]
    for relative, fingerprint in previous["materializations"].items():
        if relative.startswith(DBT_PATHS):
            outputs[relative] = fingerprint

    semantic_model = {
        "model_id": MODEL_ID,
        "builder": {"path": "platform/legacy/build_gold.py",
                    "sha256": portable_sha(ROOT / "platform/legacy/build_gold.py")},
        "description": "Static, reproducible analytics model. Tables are arrays of records; source text is accessed through detail paths.",
        "tables": model_tables,
        # Defined once, in the dbt YAML (models/gold/politics/schema.yml and the `gold` meta on
        # each metric); publish/export_politics.py writes them from the manifest.
        "relationships": previous["relationships"],
        "metrics": previous["metrics"],
        "source_files": [{"path": path, "sha256": sha} for path, sha in sorted(source_hashes.items())],
        "materializations": dict(sorted(outputs.items())),
        "quality": {"decision_points": len(points), "roll_calls": len(vote_ids), "party_vote_rows": len(party_rows),
                    "citations": len(citations), "reservations": len(reservations),
                    "complete_party_budget_frames": len(complete_frames),
                    "budget_language_comparable_rows": previous["quality"]["budget_language_comparable_rows"],
                    "parsed_law_snapshots": len(law_dim),
                    "normalized_abstain_labels": sum(row["party_position"] == "Avstår" for row in party_rows),
                    "validated_vote_direction_pairs": 0},
    }
    emit("semantic-model.json", semantic_model)
    print(f"Built {MODEL_ID}: {len(model_tables)} tables, {len(vote_ids)} roll calls, {len(source_hashes)} source files.")


if __name__ == "__main__":
    main()
