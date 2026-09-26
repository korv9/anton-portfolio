"""Build the static, versioned semantic layer from checked-in source exports.

No network access, model calls, or inferred political positions are involved.
Run ``python platform/legacy/build_gold.py`` after the upstream export builders.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))

import common
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
    payload = (json.dumps(data, ensure_ascii=False, separators=(",", ":"), sort_keys=True) + "\n").encode("utf-8")
    common.write_bytes_retrying(path, payload)
    outputs[relative] = {"sha256": hashlib.sha256(payload).hexdigest(), "bytes": len(payload)}


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
    columns = {}
    for record in records:
        for field, value in record.items():
            kind = ("null" if value is None else "boolean" if isinstance(value, bool)
                    else "number" if isinstance(value, (int, float)) else "string" if isinstance(value, str)
                    else "array" if isinstance(value, list) else "object")
            columns.setdefault(field, set()).add(kind)
    return {
        "path": relative, "rows": len(records), "grain": grain,
        "primary_key": primary_key, "join_columns": join_columns,
        "columns": {field: sorted(kinds) for field, kinds in columns.items()},
        "source": source_note, "limitations": limitations,
        **outputs[relative],
    }


def percentage(numerator, denominator):
    return round(100 * numerator / denominator, 4) if denominator else None


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
    decision_indexes = [
        (path.parent.name, rows(path))
        for path in sorted(SOURCE.glob("politics/decisions/*/index.json"))
    ]
    budget = rows(SOURCE / "debates/budgets/summary.json")
    budget_outturn = rows(SOURCE / "politics/parliament/budgets/outturn-areas.json")
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
    model_tables["fact_activity"] = table("fact_activity", activities, "One party and session", ["session", "party"], ["session", "party"], "Parliament activity summary")
    model_tables["fact_budget_frame"] = table("fact_budget_frame", budget, "One session, proposer and area", ["session", "actor", "expenditure_area"], ["session", "actor", "expenditure_area"], "Corrected exact-year budget frame", "Incomplete years and missing party proposals must not be imputed")
    model_tables["fact_budget_outturn"] = table("fact_budget_outturn", budget_outturn, "One budget year and expenditure area", ["budget_year", "expenditure_area"], ["budget_year", "expenditure_area"], "Statskontoret annual outturn aggregate", "Historical area definitions must be checked before joining a budget proposal")
    model_tables["fact_language_area"] = table("fact_language_area", language["rows"], "One corpus, method, session, party and area", ["corpus", "method", "session", "party", "expenditure_area"], ["session", "party", "expenditure_area"], "Budget-language audit", "Word matches are topic attention, not support")
    model_tables["fact_language_coverage"] = table("fact_language_coverage", language["coverage"], "One corpus, method, session and party", ["corpus", "method", "session", "party"], ["session", "party"], "Budget-language audit", "Zero matches are not evidence of silence")
    budget_groups = defaultdict(set)
    for row in budget:
        budget_groups[(row["session"], row["actor"])].add(row["expenditure_area"])
    complete_budget = {
        (row["session"], row["actor"], row["expenditure_area"]): row
        for row in budget
        if row["actor"] in PARTIES and budget_groups[(row["session"], row["actor"])] == set(range(1, 28))
    }
    budget_language = []
    for row in language["rows"]:
        frame = complete_budget.get((row["session"], row["party"], row["expenditure_area"]))
        if frame is None:
            continue
        budget_language.append({
            "corpus": row["corpus"], "method": row["method"], "session": row["session"],
            "party": row["party"], "expenditure_area": row["expenditure_area"],
            "budget_year": frame["budget_year"], "amount_msek": frame["amount_msek"],
            "budget_share_pct": frame["budget_share_pct"],
            "keyword_occurrences": row["occurrences"], "keyword_share_pct": row["keyword_share_pct"],
            "attention_minus_budget_pp": round(row["keyword_share_pct"] - frame["budget_share_pct"], 4)
            if row["keyword_share_pct"] is not None else None,
            "source_url": frame["source_url"],
        })
    model_tables["mart_budget_language_gap"] = table(
        "mart_budget_language_gap", budget_language,
        "One corpus, method, session, party and area with a complete party frame",
        ["corpus", "method", "session", "party", "expenditure_area"],
        ["session", "party", "expenditure_area"],
        "Exact-key join of corrected party frame and language audit",
        "Descriptive difference in percentage points; no stance or causal inference. Missing/incomplete party frames excluded.")

    job_month = [{**row, "new_ads": int(row["new_ads"]), "unique_employers": int(row["unique_employers"])} for row in jobs_month]
    job_year = [{**row, "year": int(row["year"]), "ads": int(row["ads"]), "unique_employers": int(row["unique_employers"])} for row in jobs_year]
    job_junior = [{**row, "junior_ads": int(row["junior_ads"]), "total_ads": int(row["total_ads"]), "junior_share_pct": float(row["junior_share_pct"])} for row in jobs_junior]
    job_technology = [{**row, "ads_mentioning": int(row["ads_mentioning"]), "share_pct": float(row["share_pct"])} for row in jobs_technology]
    model_tables["fact_job_month_role"] = table("fact_job_month_role", job_month, "One month and role", ["month", "role"], ["role"], "JobTech historical-ad aggregate", "Ads are not hires")
    model_tables["fact_job_year_role"] = table("fact_job_year_role", job_year, "One year and role", ["year", "role"], ["role"], "JobTech historical-ad aggregate", "Annual distinct-ad counts; do not sum employer counts across months")
    model_tables["fact_job_junior_month"] = table("fact_job_junior_month", job_junior, "One month and role with junior data", ["month", "role"], ["role"], "JobTech title-rule aggregate", "Absent rows are missing, not zero")
    model_tables["fact_job_technology"] = table("fact_job_technology", job_technology, "One cohort and technology", ["cohort", "technology"], [], "JobTech mention aggregate", "A mention may be optional or negated")
    model_tables["fact_topic_session_party"] = table("fact_topic_session_party", topic_session, "One model, session, party and topic", ["model_id", "session", "party", "topic_id"], ["model_id", "topic_id", "session", "party"], "Separate legacy and current topic exports", "Word shares include an unclustered category")
    umap_facts = [{field: row.get(field) for field in ("model_id", "chunk_id", "speech_id", "topic_id", "x", "y", "party", "session", "speech_date", "source_url", "session_population")} for row in umap]
    model_tables["fact_umap_sample"] = table("fact_umap_sample", umap_facts, "One sampled text segment in a model run", ["model_id", "chunk_id"], ["model_id", "topic_id", "session", "party", "speech_id"], "Deterministic UMAP export", "Sample coordinates are not comparable across model runs or ideological positions")
    model_tables["fact_law_provision"] = table("fact_law_provision", provisions, "One parsed provision in a snapshot", ["pool", "document_id", "provision_id"], ["pool", "document_id"], "Allegoria provision snapshots", "Metadata only; full text remains in versioned source shard")
    model_tables["fact_rfc_version"] = table("fact_rfc_version", rfc["versions"], "One profiled RFC version", ["rfc"], [], "RFC drift report", "Requirement counts are heuristic extraction, not matched changes")

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

    gold_votes_by_id = defaultdict(list)
    for row in party_rows:
        gold_votes_by_id[row["vote_id"]].append(row)
    vote_marts = []
    for slug, index in decision_indexes:
        result = []
        for decision in index:
            vote_id = decision["id"]
            point = point_by_vote[vote_id]
            parties = [{field: vote[field] for field in ("party", "party_position", "yes_votes", "no_votes", "abstain_votes", "absent_votes")}
                       for vote in sorted(gold_votes_by_id[vote_id], key=lambda vote: PARTIES.index(vote["party"]))]
            result.append({**decision, "point_id": point["point_id"], "parties": parties})
        relative = f"marts/votes/{slug}.json"
        emit(relative, result)
        vote_marts.append({"slug": slug, "session": point_by_vote[result[0]["id"]]["session"],
                           "path": relative, "rows": len(result)})
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
    gold_overview = {**overview, "sessions": [
        {**item, "path": next(mart["path"] for mart in vote_marts if mart["slug"] == item["slug"])}
        for item in overview["sessions"]
    ], "model_id": MODEL_ID}
    emit("overview.json", gold_overview)

    party_session_metrics = []
    agreement_metrics = []
    for mart in vote_marts:
        session = mart["session"]
        votes = [row for row in party_rows if row["session"] == session]
        by_vote = {vote_id: {row["party"]: row for row in group} for vote_id, group in grouped_votes.items() if group[0]["session"] == session}
        for party in PARTIES:
            selected = [row for row in votes if row["party"] == party]
            cast = sum(row["cast_votes"] for row in selected)
            absent = sum(row["absent_votes"] for row in selected)
            party_session_metrics.append({
                "session": session, "party": party, "roll_calls": len(selected),
                "yes_calls": sum(row["party_position"] == "Ja" for row in selected),
                "no_calls": sum(row["party_position"] == "Nej" for row in selected),
                "abstain_calls": sum(row["party_position"] == "Avstår" for row in selected),
                "cast_member_votes": cast, "recorded_absences": absent,
                "cohesion_pct": percentage(sum(max(row["yes_votes"], row["no_votes"], row["abstain_votes"]) for row in selected), cast),
                "recorded_attendance_pct": percentage(cast, cast + absent),
            })
            for other in PARTIES:
                paired = [(group[party], group[other]) for group in by_vote.values()
                          if group[party]["party_position"] in ("Ja", "Nej") and group[other]["party_position"] in ("Ja", "Nej")]
                same = sum(a["party_position"] == b["party_position"] for a, b in paired)
                agreement_metrics.append({"session": session, "party_a": party, "party_b": other,
                                          "same_position_calls": same, "comparable_calls": len(paired),
                                          "agreement_pct": percentage(same, len(paired))})
    model_tables["mart_party_session_vote"] = table("mart_party_session_vote", party_session_metrics, "One session and party", ["session", "party"], ["session", "party"], "Derived from fact_party_vote")
    model_tables["mart_party_agreement"] = table("mart_party_agreement", agreement_metrics, "One session and ordered party pair", ["session", "party_a", "party_b"], ["session", "party_a", "party_b"], "Derived from comparable Ja/Nej positions", "Not ideological distance; abstentions excluded")

    semantic_model = {
        "model_id": MODEL_ID,
        "builder": {"path": "platform/legacy/build_gold.py",
                    "sha256": portable_sha(ROOT / "platform/legacy/build_gold.py")},
        "description": "Static, reproducible analytics model. Tables are arrays of records; source text is accessed through detail paths.",
        "tables": model_tables,
        "relationships": [
            {"from": "fact_party_vote.party", "to": "dim_party.party", "type": "many_to_one", "status": "validated"},
            {"from": "fact_party_vote.session", "to": "dim_session.session", "type": "many_to_one", "status": "validated"},
            {"from": "fact_activity.party", "to": "dim_party.party", "type": "many_to_one", "status": "validated"},
            {"from": "fact_language_area.party", "to": "dim_party.party", "type": "many_to_one", "status": "validated"},
            {"from": "fact_topic_session_party.party", "to": "dim_party.party", "type": "many_to_one", "status": "validated"},
            {"from": "fact_job_month_role.role", "to": "dim_role.role", "type": "many_to_one", "status": "validated"},
            {"from": "fact_budget_frame.expenditure_area", "to": "dim_expenditure_area.expenditure_area", "type": "many_to_one", "status": "code_validated_historical_name_varies"},
            {"from": "fact_party_vote.point_id", "to": "fact_decision_point.point_id", "type": "many_to_one", "status": "validated"},
            {"from": "fact_point_citation.point_id", "to": "fact_decision_point.point_id", "type": "many_to_one", "status": "validated"},
            {"from": "fact_point_reservation.point_id", "to": "fact_decision_point.point_id", "type": "many_to_one", "status": "validated"},
            {"from": "fact_speech_vote_candidate.vote_id", "to": "fact_party_vote.vote_id", "type": "many_to_many_through_party", "status": "retrieval_candidate_only"},
            {"from": "fact_motion_vote_link.vote_id", "to": "fact_party_vote.vote_id", "type": "many_to_many_through_vote", "status": "citation_only"},
            {"from": "fact_proposition_point_link.point_id", "to": "fact_decision_point.point_id", "type": "many_to_one", "status": "document_level_only"},
            {"from": "fact_law_mention_candidate.sfs_document_id", "to": "dim_law_snapshot.document_id", "type": "candidate", "status": "temporal_version_unverified"},
            {"from": "fact_budget_frame.actor", "to": "dim_actor.actor", "type": "many_to_one", "status": "validated"},
            {"from": "fact_budget_frame.budget_year,expenditure_area", "to": "fact_budget_outturn.budget_year,expenditure_area", "type": "conditional", "status": "historical_area_definition_unverified"},
            {"from": "fact_language_area.session,party,expenditure_area", "to": "fact_budget_frame.session,actor,expenditure_area", "type": "conditional", "status": "party_proposals_only_and_coverage_checked"},
            {"from": "fact_topic_session_party.model_id,topic_id", "to": "dim_topic.model_id,topic_id", "type": "many_to_one", "status": "validated"},
            {"from": "fact_umap_sample.model_id,topic_id", "to": "dim_topic.model_id,topic_id", "type": "many_to_one", "status": "validated"},
            {"from": "fact_law_provision.pool,document_id", "to": "dim_law_snapshot.pool,document_id", "type": "many_to_one", "status": "validated"},
            {"from": "fact_job_junior_month.month,role", "to": "fact_job_month_role.month,role", "type": "conditional", "status": "shared_aggregate_grain_not_individual_ads"},
        ],
        "metrics": {
            "party_yes_call_share": {"numerator": "count(fact_party_vote where party_position = Ja)", "denominator": "count(fact_party_vote)", "unit": "percent", "filters": ["session", "committee", "party"]},
            "party_agreement": {"numerator": "same_position_calls", "denominator": "comparable_calls", "unit": "percent", "excludes": ["Avstår", "unavailable"]},
            "party_cohesion": {"numerator": "sum(max(yes_votes, no_votes, abstain_votes) per vote-party)", "denominator": "sum(cast_votes)", "unit": "percent"},
            "recorded_attendance": {"numerator": "sum(cast_votes)", "denominator": "sum(cast_votes + absent_votes)", "unit": "percent", "limitation": "pairing arrangements unknown"},
            "budget_share": {"source_column": "fact_budget_frame.budget_share_pct", "unit": "percent", "grain": "session, actor, expenditure_area"},
            "language_attention": {"source_column": "fact_language_area.keyword_share_pct", "unit": "percent", "grain": "corpus, method, session, party, expenditure_area", "limitation": "lexical attention, not support"},
            "attention_minus_budget": {"source_column": "mart_budget_language_gap.attention_minus_budget_pp", "unit": "percentage points", "formula": "keyword_share_pct - budget_share_pct", "eligibility": "Observed party proposal with all 27 expenditure areas", "limitation": "Descriptive comparison only; speeches may occur after the budget proposal"},
            "new_job_ads": {"source_column": "fact_job_month_role.new_ads", "unit": "unique ad IDs per month and role", "limitation": "not hires"},
            "topic_word_share": {"source_column": "fact_topic_session_party.word_share_pct", "unit": "percent", "grain": "model, session, party, topic", "limitation": "unclustered included; models incomparable"},
            "validated_vote_direction_pairs": {"value": 0, "status": "unavailable", "reason": "No reviewed vote-to-versioned-provision links or validated direction annotations"},
        },
        "source_files": [{"path": path, "sha256": sha} for path, sha in sorted(source_hashes.items())],
        "materializations": dict(sorted(outputs.items())),
        "quality": {"decision_points": len(points), "roll_calls": len(vote_ids), "party_vote_rows": len(party_rows),
                    "citations": len(citations), "reservations": len(reservations),
                    "complete_party_budget_frames": len({(session, actor) for session, actor, _ in complete_budget}),
                    "budget_language_comparable_rows": len(budget_language),
                    "parsed_law_snapshots": len(law_dim),
                    "normalized_abstain_labels": sum(row["party_position"] == "Avstår" for row in party_rows),
                    "validated_vote_direction_pairs": 0},
    }
    emit("semantic-model.json", semantic_model)
    print(f"Built {MODEL_ID}: {len(model_tables)} tables, {len(vote_ids)} roll calls, {len(source_hashes)} source files.")


if __name__ == "__main__":
    main()
