"""Private review workflow. Gold is a validated projection, never a parser side effect."""
from __future__ import annotations

import json
import copy
import re
import unicodedata
import uuid
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from compliance_intelligence.decision_ingest import Store
from compliance_intelligence.legal_extraction import citation, operative, validate_proposal
from compliance_intelligence.registry import encoded, interval_covers, name_key, resolve, utc_timestamp
from compliance_intelligence.sources import new_output, now, seal, verify, write_json
from lib.rawstore import sha256

KINDS = ("identity", "legal", "privacy", "publication")
REQUIRED = ("authority", "case_number", "legal_entity", "case_type", "legal_basis", "decision_date",
            "original_outcome", "status", "party_role", "attribution_scope")
LINK_PATTERN = {
    "appeal_of": r"överklagar|överklagade|har överklagats",
    "upholds": r"fastställer|avslår överklagandet",
    "modifies": r"ändrar|sätter ned|sänker",
    "annuls": r"upphäver|undanröjer",
    "supersedes": r"ersätter",
    "remands": r"återförvisar",
    "related_to": r"ärende|mål|beslut",
    "duplicate_of": r"samma beslut|kopia",
}


def canonical_case_number(value):
    value = unicodedata.normalize("NFKC", value).upper().replace("–", "-").replace("−", "-")
    value = re.sub(r"^(?:DIARIENUMMER|DNR|MÅL NR)\s*:?\s*", "", value.strip())
    return re.sub(r"\s+", "", value)


def values(record):
    return {k: c["value"] for k, c in record["claims"].items()}


def identity_check(record, snapshot):
    v = values(record)
    if snapshot is None:
        return {"status": "registry_missing", "company_id": None, "candidate_ids": []}
    if not v["legal_entity"] or not v["decision_date"]:
        return {"status": "party_or_date_missing", "company_id": None, "candidate_ids": []}
    match = resolve(snapshot, number=v["organization_number"], name=v["legal_entity"], on_date=v["decision_date"])
    if match["status"] == "verified":
        return match
    if not v["organization_number"] and len(match["candidate_ids"]) == 1:
        company = next((c for c in snapshot["companies"] if c["company_id"] == match["candidate_ids"][0]), None)
        # A brand alias alone cannot confirm the operator, even with a unique candidate.
        if (company and company["identity_status"] == "verified" and name_key(company["registered_legal_name"]) == name_key(v["legal_entity"])
                and interval_covers(company, v["decision_date"], current_name=True)
                and v["decision_date"] <= snapshot["metadata"]["as_of_date"]):
            return {**match, "status": "exact_legal_name_needs_human_verification", "company_id": company["company_id"]}
    return {**match, "company_id": None}


def completeness(record):
    v = values(record)
    required = list(REQUIRED)
    if v["original_outcome"] == "administrative_sanction":
        required.append("monetary_sanction")
    supported = [f for f in required if v[f] not in (None, "unknown", [], "context_only", "contextual_mention")
                 and record["claims"][f]["evidence"]]
    issues = ["missing_or_uncertain:" + f for f in required if f not in supported]
    if v["attribution_scope"] != "direct_legal_entity":
        issues.append("no_direct_party_scope")
    return {"required": required, "supported": supported, "missing": issues,
            "fraction": len(supported) / len(required) if required else None}


class ReviewStore(Store):
    def __init__(self, root):
        super().__init__(root)
        self.execute(Path(__file__).with_name("legal_review.sql").read_text(encoding="utf-8"))

    def document(self, document_id):
        cursor = self.execute("select * from bronze.document_version where document_id=?", [document_id])
        row = cursor.fetchone()
        if not row:
            raise ValueError("unknown_source_document")
        return dict(zip([c[0] for c in cursor.description], row))

    def audit(self, event_type, payload):
        row = self.execute("select sequence,event_hash from review.audit_log order by sequence desc limit 1").fetchone()
        sequence, previous = (row[0] + 1, row[1]) if row else (1, None)
        stamped = {"sequence": sequence, "recorded_at": now(), "event_type": event_type,
                   "payload": payload, "previous_hash": previous}
        digest = sha256(encoded(stamped))
        self.execute("insert into review.audit_log values (?,?,?,?,?,?)", [sequence, stamped["recorded_at"],
            event_type, json.dumps(payload, ensure_ascii=False), previous, digest])
        return sequence

    def verify_audit(self):
        previous, expected = None, 1
        for sequence, stamp, event_type, payload, old, digest in self.execute("select * from review.audit_log order by sequence").fetchall():
            stamped = {"sequence": sequence, "recorded_at": stamp.astimezone(timezone.utc).isoformat(), "event_type": event_type,
                       "payload": json.loads(payload), "previous_hash": old}
            # DuckDB preserves microseconds/UTC, matching now()'s canonical representation.
            if sequence != expected or old != previous or sha256(encoded(stamped)) != digest:
                raise ValueError("audit_integrity_failure")
            if event_type == "human_review":
                action = self.execute("select payload from review.action where audit_sequence=?", [sequence]).fetchone()
                if not action or json.loads(action[0]) != json.loads(payload):
                    raise ValueError("review_action_audit_mismatch")
            previous, expected = digest, expected + 1
        for digest, payload, identity, complete in self.execute("select record_hash,payload,identity_match,completeness from review.candidate").fetchall():
            parsed = json.loads(payload)
            if sha256(encoded(parsed)) != digest or parsed["identity_match"] != json.loads(identity) or parsed["completeness"] != json.loads(complete):
                raise ValueError("candidate_integrity_failure")
        return {"entries": expected - 1, "head": previous}

    def record(self, record_hash):
        row = self.execute("select payload,identity_match,registry_hash,completeness,record_id,case_id,document_id from review.candidate where record_hash=?", [record_hash]).fetchone()
        if not row:
            raise ValueError("unknown_record_hash")
        return {"payload": json.loads(row[0]), "identity": json.loads(row[1]), "registry_hash": row[2],
                "completeness": json.loads(row[3]), "record_id": row[4], "case_id": row[5], "document_id": row[6], "record_hash": record_hash}

    def current_records(self):
        return [self.record(h) for h, in self.execute("select record_hash from review.current_record order by record_id").fetchall()]

    def actions(self, record_hash):
        rows = self.execute("select payload from review.action where record_hash=? order by audit_sequence", [record_hash]).fetchall()
        return {a["review_kind"]: a for row in rows for a in [json.loads(row[0])]}

    def active_links(self, record_id):
        rows = self.execute("""select l.source_record_hash,l.target_record_id,l.target_record_hash,l.relation
            from review.decision_link l join review.current_record h on h.record_hash=l.source_record_hash
            where l.target_record_id=? or h.record_id=? order by 1,2,3,4""", [record_id, record_id]).fetchall()
        rows += self.execute("""select l.source_record_hash,l.target_record_id,l.target_record_hash,'unresolved'
            from review.pending_link l join review.current_record h on h.record_hash=l.source_record_hash
            where l.target_record_id=? or h.record_id=?""", [record_id, record_id]).fetchall()
        return sorted(r for r in rows if self.actions(r[0]).get("legal", {}).get("disposition") not in ("rejected", "withdrawn"))

    def discover_related(self, record, pages):
        """Suggest exact-docket links; several judgments on that docket stay unresolved."""
        groups, links, pending = {}, [], []
        own = values(record)
        for target in self.current_records():
            t = values(target["payload"]["proposal"])
            if t["case_number"] and t["decision_date"] and own["decision_date"] and t["decision_date"] <= own["decision_date"]:
                if target["document_id"] != record["document_id"]:
                    groups.setdefault(t["case_number"], []).append(target)
        for ref, targets in groups.items():
            if any(l["target_record_id"] in {t["record_id"] for t in targets} for l in record["links"]):
                continue
            for page in record["scope_pages"]:
                text = pages[page]
                for m in re.finditer(re.escape(ref), text, re.I):
                    e = citation(pages, page, max(0, m.start()-220), min(len(text), m.end()+150))
                    relations = [relation for relation in ("annuls", "modifies", "upholds", "appeal_of", "remands", "supersedes")
                                 if operative(e["quote"], LINK_PATTERN[relation])]
                    if not relations:
                        continue
                    dated = [t for t in targets if values(t["payload"]["proposal"])["decision_date"] in e["quote"]]
                    candidates = dated or targets
                    if len(candidates) == 1 and len(relations) == 1:
                        t = candidates[0]
                        links.append({"relation": relations[0], "target_record_id": t["record_id"],
                                      "target_record_hash": t["record_hash"], "evidence": [e]})
                    else:
                        pending.extend({"target_record_id": t["record_id"], "target_record_hash": t["record_hash"],
                                        "reason": "ambiguous_related_decision", "evidence": [e]} for t in candidates)
        links = list({(l["target_record_id"],l["relation"]): l for l in links}.values())
        pending = list({l["target_record_id"]: l for l in pending}.values())
        return links, pending

    def context(self, record_hash):
        rec = self.record(record_hash)
        links = self.active_links(rec["record_id"])
        hashes = {record_hash} | {r[0] for r in links} | {r[2] for r in links}
        states = []
        for digest in sorted(hashes):
            r = self.record(digest)
            doc = self.document(r["document_id"])
            current = self.current(doc["source_id"], doc["source_url"])
            head = self.execute("select record_hash from review.current_record where record_id=?", [r["record_id"]]).fetchone()
            states.append([digest, current[0] if current else None, head[0] if head else None])
        return sha256(encoded({"record_hash": record_hash, "registry_hash": rec["registry_hash"],
                              "links": links, "source_states": states,
                              "incoming_review_heads": [[r[0], self.actions(r[0]).get("legal", {}).get("action_id")]
                                                        for r in links if r[1] == rec["record_id"]]}))

    def add_candidate(self, record, pages, *, snapshot=None, prepared_by="pipeline"):
        record = copy.deepcopy(record)
        validate_proposal(record, pages)
        suggested, pending = self.discover_related(record, pages)
        if record["producer"]["kind"] == "deterministic":
            record["links"].extend(suggested)
        else:
            pending.extend({"target_record_id": l["target_record_id"], "target_record_hash": l["target_record_hash"],
                            "reason": "related_decision_requires_explicit_link", "evidence": l["evidence"]} for l in suggested)
        validate_proposal(record, pages)
        doc = self.document(record["document_id"])
        v = values(record)
        identity = identity_check(record, snapshot)
        registry_hash = sha256(encoded(snapshot)) if snapshot else None
        record_id = sha256(encoded([doc["document_hash"], record["decision_slot"]]))
        case_id = sha256(encoded([name_key(v["authority"]), canonical_case_number(v["case_number"])])) if v["authority"] and v["case_number"] else None
        payload = {"proposal": record, "source_url": doc["source_url"], "source_id": doc["source_id"],
                   "source_publisher": doc["authority"], "document_hash": doc["document_hash"],
                   "prepared_by": prepared_by, "registry_hash": registry_hash,
                   "identity_match": identity, "completeness": completeness(record), "pending_links": pending}
        digest = sha256(encoded(payload))
        for link in record["links"]:
            target = self.record(link["target_record_hash"])
            if target["record_id"] != link["target_record_id"] or target["record_id"] == record_id:
                raise ValueError("invalid_or_self_decision_link")
            target_values = values(target["payload"]["proposal"])
            quote = " ".join(e["quote"] for e in link["evidence"])
            if not target_values["case_number"] or name_key(target_values["case_number"]) not in name_key(quote):
                raise ValueError("link_missing_target_case_evidence")
            if not operative(quote, LINK_PATTERN[link["relation"]]):
                raise ValueError("link_missing_disposition_evidence")
            if link["relation"] not in ("related_to", "duplicate_of"):
                if not v["decision_date"] or not target_values["decision_date"] or v["decision_date"] < target_values["decision_date"]:
                    raise ValueError("link_chronology_unknown_or_reversed")
            # Reject cycles, including links across pending record versions.
            pending = [target["record_id"]]
            seen = set()
            while pending:
                node = pending.pop()
                if node == record_id:
                    raise ValueError("decision_link_cycle")
                if node in seen:
                    continue
                seen.add(node)
                pending.extend(r[0] for r in self.execute("""select l.target_record_id from review.decision_link l
                    join review.current_record h on h.record_hash=l.source_record_hash where h.record_id=?""", [node]).fetchall())
        if self.execute("select 1 from review.candidate where record_hash=?", [digest]).fetchone():
            return {"record_id": record_id, "record_hash": digest, "inserted": False}
        self.execute("begin")
        try:
            self.execute("insert into review.candidate values (?,?,?,?,?,?,?,?,?)", [digest, record_id, doc["document_id"],
                case_id, now(), json.dumps(payload, ensure_ascii=False), json.dumps(identity), registry_hash, json.dumps(completeness(record))])
            self.execute("insert into review.current_record values (?,?) on conflict(record_id) do update set record_hash=excluded.record_hash", [record_id, digest])
            for link in record["links"]:
                self.execute("insert into review.decision_link values (?,?,?,?,?)", [digest, link["target_record_id"],
                    link["target_record_hash"], link["relation"], json.dumps(link["evidence"], ensure_ascii=False)])
            for link in pending:
                self.execute("insert into review.pending_link values (?,?,?,?,?) on conflict do nothing", [digest,
                    link["target_record_id"], link["target_record_hash"], link["reason"], json.dumps(link["evidence"], ensure_ascii=False)])
            self.audit("candidate_created", {"record_hash": digest, "record_id": record_id,
                "case_id": case_id, "prepared_by": prepared_by, "producer": record["producer"]})
            self.execute("commit")
        except Exception:
            self.execute("rollback")
            raise
        return {"record_id": record_id, "record_hash": digest, "inserted": True}

    def source_fresh(self, record_hash):
        r = self.record(record_hash)
        doc = self.document(r["document_id"])
        current = self.current(doc["source_id"], doc["source_url"])
        head = self.execute("select record_hash from review.current_record where record_id=?", [r["record_id"]]).fetchone()
        return bool(current and current[0] == doc["document_id"] and head and head[0] == record_hash)

    def legal_approved(self, record_hash, as_of=None):
        action = self.actions(record_hash).get("legal")
        today = as_of or datetime.now(timezone.utc).date()
        return bool(action and action["disposition"] == "approved" and action["context_hash"] == self.context(record_hash)
                    and action["reverify_by"] >= today.isoformat() and self.source_fresh(record_hash))

    def current_status(self, record_hash, as_of=None):
        rec = self.record(record_hash)
        original = values(rec["payload"]["proposal"])["status"]
        incoming = [r for r in self.active_links(rec["record_id"]) if r[1] == rec["record_id"]]
        if any(not self.legal_approved(r[0], as_of) for r in incoming):
            return {"status": "unknown", "finality_status": "unknown", "issues": ["unreviewed_or_stale_related_decision"], "links": incoming}
        if any(self.active_links(self.record(r[0])["record_id"]) and
               any(child[1] == self.record(r[0])["record_id"] for child in self.active_links(self.record(r[0])["record_id"]))
               for r in incoming):
            return {"status": "unknown", "finality_status": "unknown", "issues": ["subsequent_appellate_stage_requires_review"], "links": incoming}
        effects = {"annuls": "annulled", "modifies": "modified", "appeal_of": "appealed",
                   "remands": "modified", "supersedes": "modified"}
        changes = {effects[r[3]] for r in incoming if r[3] in effects}
        # Several appellate stages require an explicit graph review; no timestamp heuristic.
        if len(changes) > 1:
            return {"status": "unknown", "finality_status": "unknown", "issues": ["multiple_lifecycle_effects_require_review"], "links": incoming}
        substantive = [r for r in incoming if r[3] not in ("related_to", "duplicate_of")]
        finality = "final" if original == "final" and not substantive else "unknown"
        if substantive and all(values(self.record(r[0])["payload"]["proposal"])["status"] == "final" for r in substantive):
            if any(r[3] in ("annuls", "modifies", "upholds", "supersedes") for r in substantive):
                finality = "final"
        stage = next(iter(changes)) if changes else original
        if any(r[3] == "upholds" for r in incoming) and not changes:
            stage = "final" if finality == "final" else "decided"
        return {"status": stage, "finality_status": finality, "issues": [], "links": incoming}

    def blockers(self, record_hash, *, as_of=None, include_reviews=True):
        rec = self.record(record_hash)
        issues = list(rec["completeness"]["missing"])
        if rec["identity"]["status"] not in ("verified", "exact_legal_name_needs_human_verification"):
            issues.append("entity_identity_unresolved")
        if not self.source_fresh(record_hash):
            issues.append("stale_source_or_record_version")
        v = values(rec["payload"]["proposal"])
        # ponytail: scan the small review batch; index case/date for larger collections.
        for other in self.current_records():
            if other["record_id"] == rec["record_id"] or other["case_id"] != rec["case_id"] or not rec["case_id"]:
                continue
            ov = values(other["payload"]["proposal"])
            if (self.source_fresh(other["record_hash"]) and self.actions(other["record_hash"]).get("legal", {}).get("disposition") not in ("rejected", "withdrawn")
                    and (v["decision_date"], v["legal_entity"], v["original_outcome"]) == (ov["decision_date"], ov["legal_entity"], ov["original_outcome"])):
                issues.append("possible_duplicate_decision_requires_review")
        if any(l[3] == "duplicate_of" for l in self.active_links(rec["record_id"]) if l[0] == record_hash):
            issues.append("duplicate_decision_not_exportable")
        issues.extend(self.current_status(record_hash, as_of)["issues"])
        if include_reviews:
            actions, context = self.actions(record_hash), self.context(record_hash)
            for kind in KINDS:
                a = actions.get(kind)
                if not a or a["disposition"] != "approved" or a["context_hash"] != context:
                    issues.append("review_missing_rejected_or_stale:" + kind)
            publication = actions.get("publication")
            if publication and any(actions.get(k, {}).get("reviewed_at", "") > publication["reviewed_at"] for k in ("identity", "legal", "privacy")):
                issues.append("publication_prerequisite_reviews_changed")
            if not self.legal_approved(record_hash, as_of):
                issues.append("reverification_required")
        return sorted(set(issues))

    def review(self, request, reviewers):
        self.verify_audit()
        allowed = {"record_hash", "context_hash", "review_kind", "disposition", "reviewer_id", "rationale",
                   "human_attestation", "examined_evidence", "verified_at", "reverify_by", "privacy_cleared", "reuse_cleared"}
        if set(request) - allowed or not all(k in request for k in ("record_hash", "context_hash", "review_kind", "disposition", "reviewer_id", "rationale", "human_attestation", "examined_evidence")):
            raise ValueError("invalid_review_request")
        kind, disposition, actor = request["review_kind"], request["disposition"], request["reviewer_id"]
        principal = reviewers.get(actor, {})
        if kind not in KINDS or disposition not in ("approved", "rejected", "withdrawn"):
            raise ValueError("invalid_review_kind_or_disposition")
        if (principal.get("kind") != "human" or kind not in principal.get("roles", [])
                or request["human_attestation"] is not True or request["examined_evidence"] is not True
                or not str(request["rationale"]).strip()):
            raise ValueError("authorized_human_review_required")
        rec = self.record(request["record_hash"])
        if actor == rec["payload"]["prepared_by"]:
            raise ValueError("preparer_cannot_approve_own_record")
        if request["context_hash"] != self.context(request["record_hash"]):
            raise ValueError("review_context_changed")
        if disposition == "approved":
            if not self.source_fresh(request["record_hash"]):
                raise ValueError("stale_source_or_record_version")
            if kind == "identity" and rec["identity"]["status"] not in ("verified", "exact_legal_name_needs_human_verification"):
                raise ValueError("entity_identity_unresolved")
            if kind == "legal":
                if rec["payload"].get("pending_links"):
                    raise ValueError("resolve_related_decision_targets_before_legal_approval")
                # Court follow-up records may lack company identity; link review is separate from attribution.
                missing = [i for i in rec["completeness"]["missing"] if not any(s in i for s in ("legal_entity", "party_role", "attribution_scope", "direct_party_scope"))]
                if missing:
                    raise ValueError("evidence_incomplete:" + ",".join(missing))
                stamp = datetime.fromisoformat(utc_timestamp(request["verified_at"]))
                current = datetime.now(timezone.utc)
                due = date.fromisoformat(request["reverify_by"])
                maximum = 90 if self.current_status(request["record_hash"])["finality_status"] == "final" else 30
                if stamp > current or not current.date() <= due <= stamp.date() + timedelta(days=maximum):
                    raise ValueError("invalid_reverification_interval")
            if kind == "privacy" and (request.get("privacy_cleared") is not True or request.get("reuse_cleared") is not True):
                raise ValueError("explicit_privacy_and_reuse_clearance_required")
            if kind == "publication":
                actions = self.actions(request["record_hash"])
                if any(actions.get(k, {}).get("reviewer_id") == actor for k in ("identity", "legal", "privacy")):
                    raise ValueError("independent_publication_reviewer_required")
                issues = self.blockers(request["record_hash"])
                issues = [i for i in issues if i not in ("review_missing_rejected_or_stale:publication", "publication_prerequisite_reviews_changed")]
                if issues:
                    raise ValueError("publication_blocked:" + ",".join(issues))
        action = {**request, "action_id": str(uuid.uuid4()), "reviewed_at": now()}
        self.execute("begin")
        try:
            sequence = self.audit("human_review", action)
            self.execute("insert into review.action values (?,?,?,?,?,?,?,?,?,?,?,?)", [action["action_id"],
                request["record_hash"], request["context_hash"], kind, disposition, actor, action["reviewed_at"],
                request.get("verified_at"), request.get("reverify_by"), request["rationale"], json.dumps(action), sequence])
            self.execute("commit")
        except Exception:
            self.execute("rollback")
            raise
        return action

    def queue(self, as_of=None):
        return [{"record_id": r["record_id"], "record_hash": r["record_hash"], "case_id": r["case_id"],
                 "context_hash": self.context(r["record_hash"]), "identity_status": r["identity"]["status"],
                 "completeness": r["completeness"], "blockers": self.blockers(r["record_hash"], as_of=as_of),
                 "reviews": self.actions(r["record_hash"])} for r in self.current_records()]

    def summary(self):
        queue = self.queue()
        source_coverage = {}
        for report, stamp in self.execute("select report,finished_at from bronze.ingestion_run where report is not null order by finished_at desc").fetchall():
            for source, observation in json.loads(report).get("sources", {}).items():
                source_coverage.setdefault(source, {"as_of_utc": stamp.astimezone(timezone.utc).isoformat(),
                    "status": observation["status"], "coverage_fraction": observation.get("coverage_fraction")})
        return {"as_of_utc": now(), "candidate_records": len(queue),
                "case_groups": self.execute("select count(*) from review.case_groups").fetchone()[0],
                "unresolved_identity": sum(r["identity_status"] not in ("verified", "exact_legal_name_needs_human_verification") for r in queue),
                "evidence_complete": sum(not r["completeness"]["missing"] for r in queue),
                "publication_eligible": sum(not r["blockers"] for r in queue),
                "human_review_actions": self.execute("select count(*) from review.action").fetchone()[0],
                "review_approvals": {kind: sum(r["reviews"].get(kind, {}).get("disposition") == "approved"
                    and r["reviews"][kind]["context_hash"] == r["context_hash"] for r in queue) for kind in KINDS},
                "source_coverage": source_coverage,
                "evidence_access": dict(self.execute("select result,count(*) from review.evidence_access group by result").fetchall()),
                "status_basis": "unreviewed candidates are not legal facts", "audit": self.verify_audit(),
                "cohort_coverage_fraction": None}

    def validate_release(self, directory):
        self.verify_audit()
        verify(directory)
        directory = Path(directory)
        manifest = json.loads((directory / "release-manifest.json").read_text(encoding="utf-8"))
        rows = json.loads((directory / "decisions.json").read_text(encoding="utf-8"))
        if manifest["record_count"] != len(rows):
            raise ValueError("release_count_mismatch")
        for row in rows:
            if self.blockers(row["record_hash"]) or row["review_context_hash"] != self.context(row["record_hash"]):
                raise ValueError("release_approval_expired_revoked_or_stale")
            if row != self.gold_record(row["record_hash"], status_as_of=row["status_as_of"]):
                raise ValueError("release_projection_differs_from_reviewed_record")
        if len({r["record_id"] for r in rows}) != len(rows):
            raise ValueError("release_contains_duplicate_decision")
        if (directory / "decisions.parquet").exists():
            import pyarrow.parquet as pq
            if pq.read_table(directory / "decisions.parquet").to_pylist() != rows:
                raise ValueError("release_parquet_json_mismatch")
        return {"valid": True, "record_count": len(rows), "checked_at": now()}

    def gold_record(self, record_hash, *, status_as_of=None):
        rec = self.record(record_hash)
        proposal = rec["payload"]["proposal"]
        v, lifecycle = values(proposal), self.current_status(record_hash)
        legal = self.actions(record_hash).get("legal", {})
        sources = []
        for digest, _, _, relation in lifecycle["links"]:
            linked = self.record(digest)
            child = values(linked["payload"]["proposal"])
            sources.append({"record_id": linked["record_id"], "relation": relation,
                "authority": child["authority"], "case_number": child["case_number"], "decision_date": child["decision_date"],
                "source_url": linked["payload"]["source_url"], "document_hash": linked["payload"]["document_hash"]})
        return {"record_id": rec["record_id"], "record_hash": record_hash, "case_id": rec["case_id"],
            "review_context_hash": self.context(record_hash),
            "company_id": rec["identity"]["company_id"], **{f: v[f] for f in ("authority", "case_number", "legal_entity", "organization_number", "case_type",
                "legal_basis", "decision_date", "publication_date", "original_outcome", "party_role", "attribution_scope", "appeal_information")},
            "original_monetary_sanction": v["monetary_sanction"], "original_status": v["status"],
            "current_known_status": lifecycle["status"], "effective_monetary_sanction": v["monetary_sanction"] if lifecycle["finality_status"] == "final" and lifecycle["status"] not in ("annulled", "modified", "unknown") else None,
            "finality_status": lifecycle["finality_status"], "subsequent_decisions": sources,
            "source_url": rec["payload"]["source_url"], "document_hash": rec["payload"]["document_hash"],
            "last_verified_at": legal.get("verified_at"), "reverify_by": legal.get("reverify_by"),
            "review_status": "approved" if not self.blockers(record_hash) else "preview_not_approved", "status_as_of": status_as_of or now()}

    def export_gold(self, output):
        self.verify_audit()
        records = []
        for rec in self.current_records():
            if self.blockers(rec["record_hash"]):
                continue
            records.append(self.gold_record(rec["record_hash"]))
        # An approved projection is staged privately; deployment/upload is a separate action.
        with new_output(output) as stage:
            write_json(stage / "decisions.json", records)
            write_json(stage / "release-manifest.json", {"schema_version": 1, "created_at": now(), "record_count": len(records),
                "audit_head": self.verify_audit()["head"], "review_policy": "four-human-review-gates-v1"})
            if records:
                import pyarrow as pa
                import pyarrow.parquet as pq
                pq.write_table(pa.Table.from_pylist(records), stage / "decisions.parquet")
            seal(stage)
        return {"record_count": len(records), "output": str(output)}
