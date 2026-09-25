"""Materialize sourced budget-year context and exact parliamentary vote links.

The government proposal is a collective document. Never copy its amounts into
individual party proposals or turn a speech similarity into a voting motive.
"""

import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GOLD = ROOT / "public/data/gold"
PARTIES = ("C", "KD", "L", "M", "MP", "S", "SD", "V")


def read(name):
    return json.loads((GOLD / name).read_text(encoding="utf-8"))


def main():
    frames = read("tables/fact_budget_frame.json")
    points = read("tables/fact_decision_point.json")
    votes = read("tables/fact_party_vote.json")
    citations = read("tables/fact_point_citation.json")
    reservations = read("tables/fact_point_reservation.json")
    speech_candidates = read("tables/fact_speech_vote_candidate.json")
    coverage = json.loads((ROOT / "public/data/debates/budgets/coverage.json").read_text(encoding="utf-8"))
    counts = Counter((row["session"], row["actor"]) for row in frames)
    docs = {row["session"]: row for row in coverage["documents"]}
    errors = {row["session"]: row for row in coverage["errors"]}
    years = []
    for start in range(2014, 2026):
        session = f"{start}/{str(start + 1)[-2:]}"
        doc_id = docs[session]["document_id"] if session in docs else errors[session]["candidates"][0]["document_id"]
        governing = ["S", "MP"] if start <= 2020 else ["S", "MP"] if start == 2021 else ["M", "KD", "L"]
        support = ["SD"] if start >= 2022 else ["C", "L"] if start in (2019, 2020) else []
        agreement_source = (
            "https://data.riksdagen.se/dokument/H701FIU2" if start == 2019 else
            "https://data.riksdagen.se/dokument/H801AU1" if start == 2020 else
            "https://www.regeringen.se/pressmeddelanden/2026/05/regeringen-och-sverigedemokraterna-presenterar-bokslut-over-tidoavtalet/" if start >= 2022 else None
        )
        # Three exceptions are stated in the official budget-process review.
        alternative = {
            2014: ["M", "C", "L", "KD"],
            2018: ["M", "KD"],
            2021: ["M", "SD", "KD"],
        }
        point = next((p for p in points if p["session"] == session and p["designation"] == "FiU1" and p["point"] == 2), None)
        vote_id = point["vote_id"] if point else None
        year_votes = sorted(({
            "party": v["party"], "position": v["party_position"],
            "yes": v["yes_votes"], "no": v["no_votes"],
            "abstain": v["abstain_votes"], "absent": v["absent_votes"],
        } for v in votes if v["vote_id"] == vote_id), key=lambda v: PARTIES.index(v["party"])) if vote_id else []
        if year_votes and len(year_votes) != len(PARTIES):
            raise ValueError(f"Incomplete imported party vote: {session}")
        point_citations = sorted(({
            "reference": c["document_reference"], "type": c["document_type"],
            "url": c["document_url"], "evidence": c["link_evidence"],
        } for c in citations if c["point_id"] == (point or {}).get("point_id")), key=lambda c: (c["type"], c["reference"]))
        related_speeches = []
        if vote_id:
            for party in PARTIES:
                candidates = [s for s in speech_candidates if s["vote_id"] == vote_id and s["party"] == party]
                if candidates:
                    best = max(candidates, key=lambda s: s.get("cosine_similarity") or 0)
                    related_speeches.append({"party": party, "speech_id": best["speech_id"], "url": best["speech_url"], "evidence": "semantic_candidate_only"})
        years.append({
            "session": session, "budget_year": start + 1,
            "government_parties": governing, "agreement_party": support,
            "agreement_source_url": agreement_source,
            "comparison_source_url": f"https://data.riksdagen.se/dokument/{doc_id}",
            "decision_document": doc_id,
            "adopted": "alternative" if start in alternative else "government_proposal",
            "adopted_parties": alternative.get(start, governing + support),
            "adoption_source_url": (
                "https://www.regeringen.se/contentassets/c3c8d6e9fa074489a0424e84d87e04f9/budgetprocessen-i-det-finanspolitiska-ramverket-sou-202393.pdf"
                if start in alternative else f"https://data.riksdagen.se/dokument/{doc_id}"
            ),
            "frame_rows": {actor: counts[(session, actor)] for actor in ("GOV",) + PARTIES},
            "frame_status": "complete" if counts[(session, "GOV")] == 27 else "partial" if counts[(session, "GOV")] else "not_imported",
            "decision_point": point["point_id"] if point else None,
            "decision_date": point["decision_date"] if point else None,
            "vote_id": vote_id, "party_votes": year_votes,
            "cited_documents": point_citations,
            "reservations": sorted({r["party"] for r in reservations if r["point_id"] == (point or {}).get("point_id")}),
            "related_speeches": related_speeches,
            "link_quality": {
                "budget_to_decision": "exact_FiU1_point_2" if point else "document_level_only",
                "decision_to_vote": "exact_roll_call" if vote_id else "not_imported",
                "speech_to_vote": "semantic_candidate_not_a_stance" if related_speeches else "not_imported",
                "cited_document_to_point": "explicit_citation_not_party_support" if point_citations else "not_imported",
            },
        })
    result = {
        "scope": "Annual central-government budget decisions, parliamentary sessions 2014/15–2025/26",
        "method": "Government and adopted proposal are separate. Party votes refer to the committee's FiU1 point 2, not to every cited motion. Speech links are discovery candidates only.",
        "years": years,
    }
    target = GOLD / "marts/budget-context.json"
    target.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"Built budget context: {len(years)} years, {sum(bool(y['party_votes']) for y in years)} exact roll calls")


if __name__ == "__main__":
    main()
