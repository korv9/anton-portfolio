"""Register normalization and conservative entity resolution, without case attribution."""
from __future__ import annotations

import json
import re
import unicodedata
from datetime import date, datetime
from pathlib import Path
from urllib.parse import quote, urlparse

from lib.rawstore import sha256

POLICY = json.loads(Path(__file__).with_name("policy.json").read_text(encoding="utf-8"))


def encoded(value) -> bytes:
    return (json.dumps(value, sort_keys=True, ensure_ascii=False, allow_nan=False,
                       separators=(",", ":")) + "\n").encode("utf-8")


def organization_number(value: str) -> str:
    """Accept ten digits, the usual hyphen, or SCB's legal-person prefix 16."""
    text = str(value).strip()
    if re.fullmatch(r"16[0-9]{10}", text):
        text = text[2:]
    if not re.fullmatch(r"[0-9]{6}-?[0-9]{4}", text):
        raise ValueError("Invalid organization-number format")
    number = text.replace("-", "")
    if int(number[2]) < 2 or number[0] < "2":
        raise ValueError("Natural-person identifiers are excluded")
    products = [int(digit) * (2 if i % 2 == 0 else 1) for i, digit in enumerate(number)]
    if sum(n // 10 + n % 10 for n in products) % 10:
        raise ValueError("Invalid organization-number checksum")
    return number


def name_key(value: str) -> str:
    return " ".join(unicodedata.normalize("NFKC", value).casefold().split())


def utc_timestamp(value: str) -> str:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None or parsed.utcoffset().total_seconds() != 0:
        raise ValueError("Timestamp must have an explicit UTC offset")
    return parsed.isoformat()


def https_url(value: str) -> str:
    parsed = urlparse(value)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError("Source URL must be HTTPS without credentials")
    if parsed.query or parsed.fragment:
        raise ValueError("Source URLs must omit query parameters; use request_params")
    return value


def relative_file(root: Path, relative: str) -> Path:
    candidate = (root / relative).resolve()
    if not candidate.is_relative_to(root.resolve()) or Path(relative).is_absolute():
        raise ValueError("Evidence path escapes its source directory")
    return candidate


def reviewed(value) -> bool:
    return (isinstance(value, dict) and bool(str(value.get("reviewer_id", "")).strip())
            and bool(value.get("reviewed_at")) and bool(utc_timestamp(value["reviewed_at"])))


def company_record(row: dict, document: dict, *, verified: bool, as_of_date: str) -> dict:
    country = str(row.get("country_code", "SE")).upper()
    if not re.fullmatch("[A-Z]{2}", country):
        raise ValueError("Invalid registration country")
    if country == "SE":
        number = organization_number(row["organization_number"])
        registry = "scb" if document["source_id"] == "scb_company_register" else row.get("registry_authority", "bolagsverket")
        registry_number = number
        company_id = "se:orgnr:" + number
    else:
        if row.get("organization_number"):
            raise ValueError("Foreign parents must not have a Swedish organization number")
        number = None
        registry = str(row["registry_authority"]).strip()
        registry_number = str(row["registry_number"]).strip()
        if not registry or not registry_number:
            raise ValueError("Foreign entity requires its local register identity")
        company_id = country.lower() + ":" + quote(registry, safe="") + ":" + quote(registry_number, safe="")
    legal_name = row["registered_legal_name"]
    if not isinstance(legal_name, str) or not legal_name.strip():
        raise ValueError("Registered legal name is required")
    legal_name = legal_name.strip()
    active = row.get("active")
    if active in ("true", "1", 1, True):
        active = True
    elif active in ("false", "0", "9", 0, False):
        active = False
    elif active in (None, ""):
        active = None
    else:
        raise ValueError("Unknown activity code")
    sni = str(row.get("primary_sni_code") or "").replace(".", "")
    if sni and not re.fullmatch("[0-9]{5}", sni):
        raise ValueError("Primary SNI must contain five digits")
    size_class = str(row.get("employee_size_class") or "0")
    if not re.fullmatch("[0-9]{1,2}", size_class):
        raise ValueError("Employee size class must be a code, not an exact headcount")
    size_class = str(int(size_class))
    legal_form = str(row["legal_form"]).strip()
    if country == "SE" and legal_form == "96":
        raise ValueError("Foreign legal person requires its registration country and local registry identity")
    entity_kind = row.get("entity_kind") or "legal_entity"
    if entity_kind not in ("legal_entity", "registered_branch"):
        raise ValueError("Invalid entity kind")
    valid_from, valid_to = row.get("valid_from") or None, row.get("valid_to") or None
    validate_interval(valid_from, valid_to)
    return {
        "company_id": company_id, "organization_number": number,
        "registered_legal_name": legal_name, "country_code": country,
        "registry_authority": registry, "registry_number": registry_number,
        "legal_form": "AB" if legal_form == "49" else legal_form,
        "entity_kind": entity_kind,
        "active": active, "primary_sni_code": sni,
        "sni_version": str(row.get("sni_version") or ""),
        "employee_size_class": size_class,
        "identity_status": "verified" if verified else "unverified",
        "valid_from": valid_from, "valid_to": valid_to, "snapshot_date": as_of_date,
        "source_document_id": document["document_id"],
        "source_url": document["source_url"], "document_hash": document["document_hash"],
        "source_locator": str(row.get("source_locator", "row")),
        "last_verified_at": row["review"]["reviewed_at"] if reviewed(row.get("review")) else document["fetched_at"],
        "identity_review": row.get("review"),
    }


def validate_interval(start, end):
    if start:
        date.fromisoformat(start)
    if end:
        date.fromisoformat(end)
    if start and end and end <= start:
        raise ValueError("Invalid effective interval")


def interval_covers(row: dict, on_date: str, *, current_name=False) -> bool:
    if current_name and on_date > row["snapshot_date"]:
        return False
    if current_name and on_date == row["snapshot_date"]:
        return (not row.get("valid_from") or row["valid_from"] <= on_date) and (not row.get("valid_to") or on_date < row["valid_to"])
    return bool(row.get("valid_from") and row["valid_from"] <= on_date
                and (not row.get("valid_to") or on_date < row["valid_to"]))


def normalize_snapshot(rows: list[dict], documents: list[dict], metadata: dict,
                       *, verified=False, aliases=None, relationships=None) -> dict:
    """Keep conflicting observations held separately; never choose a winning name."""
    as_of = date.fromisoformat(metadata["as_of_date"]).isoformat()
    if as_of > utc_timestamp(metadata["fetched_at"])[:10]:
        raise ValueError("Population as-of date cannot be after its retrieval date")
    docs = {d["document_id"]: d for d in documents}
    if len(docs) != len(documents):
        raise ValueError("Duplicate evidence document IDs")
    groups, exclusions = {}, []
    for index, row in enumerate(rows):
        try:
            record = company_record(row, docs[row["source_document_id"]],
                                    verified=verified or reviewed(row.get("review")), as_of_date=as_of)
        except (ValueError, KeyError) as exc:
            reason = str(exc)
            if reason == "Natural-person identifiers are excluded" and str(row.get("legal_form")) in ("49", "AB"):
                reason = "Limited-company legal form conflicts with a natural-person identifier"
            exclusions.append({"row": index + 1, "source_document_id": row.get("source_document_id"),
                               "source_locator": row.get("source_locator"), "reason": reason})
            continue
        groups.setdefault(record["company_id"], []).append(record)
    companies, conflicts, duplicates = [], [], 0
    for company_id, observations in sorted(groups.items()):
        signatures = {encoded({k: v for k, v in r.items() if k not in
            {"source_document_id", "source_url", "document_hash", "source_locator", "last_verified_at", "identity_review"}})
            for r in observations}
        if len(signatures) > 1:
            conflicts.append({"company_id": company_id, "reason": "conflicting_register_observations",
                              "observations": sorted(observations, key=encoded)})
        else:
            companies.append(sorted(observations, key=encoded)[0])
            duplicates += len(observations) - 1
    result = {"schema_version": 1, "metadata": metadata, "documents": documents,
              "companies": companies, "conflicts": conflicts, "exclusions": exclusions,
              "duplicate_observations": duplicates,
              "aliases": aliases or [], "relationships": relationships or []}
    validate_identity_evidence(result)
    return result


def validate_identity_evidence(snapshot):
    companies = {r["company_id"]: r for r in snapshot["companies"]}
    docs = {d["document_id"] for d in snapshot["documents"]}
    for table in ("aliases", "relationships"):
        for row in snapshot[table]:
            row["valid_from"], row["valid_to"] = row.get("valid_from") or None, row.get("valid_to") or None
            if row["company_id"] not in companies or row["source_document_id"] not in docs:
                raise ValueError("Identity evidence refers to an absent or conflicting entity/document")
            validate_interval(row.get("valid_from"), row.get("valid_to"))
            if row.get("review_status") != "approved" or not reviewed(row.get("review")):
                raise ValueError("Alias/relationship requires an explicit evidence review")
            if not str(row.get("source_locator", "")).strip():
                raise ValueError("Alias/relationship requires a source locator")
            if table == "aliases":
                if row["alias_type"] not in ("brand", "trading_name", "historic_legal_name") or not isinstance(row["alias"], str) or not row["alias"].strip():
                    raise ValueError("Invalid alias")
            else:
                if row["related_company_id"] not in companies or row["company_id"] == row["related_company_id"]:
                    raise ValueError("Invalid relationship endpoints")
                if row["relationship_type"] not in ("subsidiary_of", "merged_into", "branch_of"):
                    raise ValueError("Invalid relationship type")
    # Check dated parent graphs at every interval boundary, including unknown-start edges.
    boundaries = {snapshot["metadata"]["as_of_date"], "0001-01-01"}
    boundaries.update(r[k] for r in snapshot["relationships"] for k in ("valid_from", "valid_to") if r.get(k))
    for boundary in boundaries:
        edges = {}
        for r in snapshot["relationships"]:
            if r["relationship_type"] == "merged_into":
                continue
            if (not r.get("valid_from") or r["valid_from"] <= boundary) and (not r.get("valid_to") or boundary < r["valid_to"]):
                old = edges.setdefault(r["company_id"], r["related_company_id"])
                if old != r["related_company_id"]:
                    raise ValueError("Conflicting parent/operator relationships")
        for node in edges:
            visited = set()
            while node in edges:
                if node in visited:
                    raise ValueError("Corporate relationship cycle")
                visited.add(node)
                node = edges[node]


def resolve(snapshot, *, number=None, name=None, country="SE", on_date=None,
            registry_authority=None, registry_number=None, subject_role="company"):
    """Only exact register identity can verify; names alone always need review."""
    if subject_role not in ("company", "issuer"):
        raise ValueError("Subject role must be company or issuer")
    country = country.upper()
    if not re.fullmatch("[A-Z]{2}", country):
        raise ValueError("Use a two-letter registration country code")
    when = date.fromisoformat(on_date or snapshot["metadata"]["as_of_date"]).isoformat()
    candidates, reasons = set(), []
    future = when > snapshot["metadata"]["as_of_date"]
    if future:
        reasons.append("date_after_snapshot")
    companies = {r["company_id"]: r for r in snapshot["companies"] if r["country_code"] == country}
    exact_id = None
    if number:
        if country != "SE":
            raise ValueError("Swedish organization number cannot identify a foreign company")
        exact_id = "se:orgnr:" + organization_number(number)
    elif registry_number:
        if not registry_authority:
            raise ValueError("Foreign/local registry number requires its registry authority")
        exact_id = next((c["company_id"] for c in companies.values() if
            c["registry_authority"] == registry_authority and c["registry_number"] == registry_number), None)
        if exact_id is None:
            reasons.append("unknown_registry_identity")
    if not number and not registry_number and not name:
        raise ValueError("Supply an organization number, registry identity or name")
    key = name_key(name) if name else None
    matching_names, temporal_names = set(), set()
    for c in companies.values():
        if key and name_key(c["registered_legal_name"]) == key:
            matching_names.add(c["company_id"])
            if interval_covers(c, when, current_name=True):
                temporal_names.add(c["company_id"])
    for alias in snapshot["aliases"]:
        if key and alias["company_id"] in companies and name_key(alias["alias"]) == key:
            matching_names.add(alias["company_id"])
            if interval_covers(alias, when):
                temporal_names.add(alias["company_id"])
    conflict_ids = set()
    for conflict in snapshot["conflicts"]:
        if any(r["country_code"] == country and (r["company_id"] == exact_id or
               (key and name_key(r["registered_legal_name"]) == key)) for r in conflict["observations"]):
            conflict_ids.add(conflict["company_id"])
    candidates.update(matching_names | conflict_ids)
    if exact_id:
        if exact_id in companies:
            candidates.add(exact_id)
            c = companies[exact_id]
            if key and exact_id not in temporal_names:
                reasons.append("name_or_effective_date_conflict")
            elif not key and not interval_covers(c, when, current_name=True):
                reasons.append("historic_identity_not_verified")
            elif c["identity_status"] == "verified" and not conflict_ids and not future:
                return {"status": "verified", "company_id": exact_id, "candidate_ids": [exact_id],
                        "method": "exact_registry_identity", "reasons": [], "subject_role": subject_role,
                        "country_code": country, "as_of_date": when}
            else:
                reasons.append("identity_not_verified")
        elif exact_id not in conflict_ids:
            reasons.append("unknown_registry_identity")
    elif matching_names:
        reasons.append("name_only_requires_review")
    if conflict_ids:
        reasons.append("conflicting_register_observations")
    status = "ambiguous" if conflict_ids or len(candidates) > 1 or "name_or_effective_date_conflict" in reasons else (
        "unverified" if candidates else "unmatched")
    return {"status": status, "company_id": None, "candidate_ids": sorted(candidates),
            "method": "candidate_search", "reasons": reasons, "subject_role": subject_role,
            "country_code": country, "as_of_date": when}


def explore(snapshot, query: str, *, cohort_ids=(), limit=20):
    if not name_key(query) or not 1 <= limit <= 100:
        raise ValueError("Supply a nonempty query and limit between 1 and 100")
    ids = {r["company_id"] for r in snapshot["aliases"] if name_key(query) in name_key(r["alias"])}
    return [{"company_id": c["company_id"], "registered_legal_name": c["registered_legal_name"],
             "country_code": c["country_code"], "identity_status": c["identity_status"],
             "cohort_member": c["company_id"] in cohort_ids, "match_status": "candidate"}
            for c in sorted(snapshot["companies"], key=lambda r: r["company_id"])
            if c["company_id"] in ids or name_key(query) in name_key(c["registered_legal_name"])
            or name_key(query) in name_key(c["registry_number"])][:limit]
