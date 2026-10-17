"""Deterministic cohort selection and sealed, private registry exports."""
from __future__ import annotations

import csv
import json
import shutil
from collections import Counter
from pathlib import Path

import duckdb

from lib.rawstore import sha256
from compliance_intelligence.registry import POLICY, encoded, https_url, reviewed
from compliance_intelligence.sources import load_snapshot, new_output, now, seal, verify, write_json


def exclusion_reason(company):
    checks = (
        (company["country_code"] == "SE", "foreign_registration"),
        (company["entity_kind"] == "legal_entity", "registered_branch"),
        (company["legal_form"] == "AB", "ineligible_legal_form"),
        (company["active"] is True, "inactive_or_unknown_activity"),
        (company["sni_version"] == POLICY["sni_version"], "unreviewed_sni_version"),
        (company["primary_sni_code"] in POLICY["primary_sni_codes"], "ineligible_primary_industry"),
        (company["employee_size_class"] in POLICY["employee_size_class_order"], "unknown_size_class"),
        (company["identity_status"] == "verified", "unverified_identity"),
    )
    return next((reason for passed, reason in checks if not passed), None)


def select_cohort(snapshot, cohort_id, *, private_only=False):
    if not cohort_id or not all(ch.isalnum() or ch in "-_" for ch in cohort_id):
        raise ValueError("Cohort ID must contain letters, digits, hyphens or underscores")
    meta = snapshot["metadata"]
    if meta.get("population_complete") is not True:
        raise ValueError("Cohort requires a complete eligible population, not a search sample")
    if set(meta.get("primary_sni_codes", [])) != set(POLICY["primary_sni_codes"]) or meta.get("sni_version") != "2025":
        raise ValueError("Population scope must cover all six primary SNI 2025 segments")
    if meta.get("acquisition_method") != "scb_api_v1" and not reviewed(meta.get("completeness_review")):
        raise ValueError("Local population completeness requires a documented review")
    if private_only and (meta.get('acquisition_method') != 'scb_api_v1' or meta.get('source_id') != 'scb_company_register'):
        raise ValueError('Private research selection requires the directly acquired SCB population')
    if not private_only and not reviewed(meta.get("reuse_review")):
        raise ValueError("Review source terms before freezing a cohort")
    https_url(meta["terms_url"])
    exclusions = list(snapshot["exclusions"]) + [
        {"company_id": c["company_id"], "reason": c["reason"]} for c in snapshot["conflicts"]]
    eligible = []
    for company in snapshot["companies"]:
        reason = exclusion_reason(company)
        if reason:
            exclusions.append({"company_id": company["company_id"], "reason": reason})
        else:
            eligible.append(company)
    order = {code: i for i, code in enumerate(POLICY["employee_size_class_order"], 1)}
    eligible.sort(key=lambda c: (-order[c["employee_size_class"]], c["organization_number"]))
    if len(eligible) < POLICY["target_size"]:
        raise ValueError(f"Only {len(eligible)} verified eligible companies; exactly 50 are required")
    if snapshot["conflicts"]:
        # A held large company could otherwise change which firm occupies rank 50.
        raise ValueError("Resolve conflicting register observations before freezing the population")
    unexpected = [r for r in snapshot["exclusions"] if r["reason"] not in (
        "Natural-person identifiers are excluded",
        "Foreign legal person requires its registration country and local registry identity")]
    if unexpected:
        raise ValueError("Resolve malformed register rows before freezing the population")
    selected = []
    fields = ("company_id", "organization_number", "registered_legal_name", "country_code",
              "registry_authority", "registry_number", "primary_sni_code", "sni_version",
              "employee_size_class", "identity_status", "source_url", "document_hash", "last_verified_at")
    for rank, c in enumerate(eligible[:50], 1):
        selected.append({**{k: c[k] for k in fields}, "cohort_id": cohort_id,
                         "as_of_date": meta["as_of_date"], "selection_rank": rank,
                         "size_class_order": order[c["employee_size_class"]],
                         "source_document_id": c["source_document_id"]})
    for c in eligible[50:]:
        exclusions.append({"company_id": c["company_id"], "reason": "below_selection_boundary"})
    hash_fields = ("company_id", "organization_number", "registered_legal_name", "primary_sni_code",
                   "sni_version", "employee_size_class", "size_class_order", "selection_rank")
    membership_hash = sha256(encoded({"cohort_id": cohort_id, "as_of_date": meta["as_of_date"],
        "policy": POLICY, "members": [{k: r[k] for k in hash_fields} for r in selected]}))
    boundary = selected[-1]["employee_size_class"]
    methodology = {"schema_version": 1, "cohort_id": cohort_id, "as_of_date": meta["as_of_date"],
        "selection_scope": "private_research" if private_only else "reuse_reviewed",
        "source_reuse_status": "reviewed" if reviewed(meta.get('reuse_review')) else "not_reviewed_for_publication",
        "methodology_version": POLICY["methodology_version"], "policy": POLICY,
        "selection_order": ["employee_size_class_order descending", "organization_number ascending"],
        "eligible_population_count": len(eligible), "selected_count": 50,
        "boundary_size_class": boundary,
        "boundary_class_population": sum(c["employee_size_class"] == boundary for c in eligible),
        "boundary_class_selected": sum(c["employee_size_class"] == boundary for c in selected),
        "exclusions_by_reason": dict(sorted(Counter(r["reason"] for r in exclusions).items())),
        "duplicate_observations": snapshot["duplicate_observations"],
        "membership_hash": membership_hash,
        "limitations": ["Size-class sample with deterministic ties; not the 50 largest by exact headcount",
                        "Legal entities are sampled separately even when they share a parent",
                        meta.get("limitations", "Source history and update lags follow the register")],
        "selection_code_sha": code_hash(), "runtime_duckdb": duckdb.__version__}
    return selected, methodology, exclusions


def code_hash():
    folder = Path(__file__).parent
    return sha256(encoded({p.name: sha256(p.read_bytes()) for p in sorted(folder.iterdir())
                           if p.suffix in (".py", ".sql", ".json")}))


def insert_rows(connection, table, fields, rows):
    if len(rows) >= 1000:
        import pyarrow as pa
        connection.register('_compliance_insert',pa.Table.from_pydict({field:[row.get(field) for row in rows] for field in fields}))
        try:
            connection.execute(f"insert into compliance_intelligence.{table} ({','.join(fields)}) select {','.join(fields)} from _compliance_insert")
        finally:
            connection.unregister('_compliance_insert')
        return
    if rows:
        connection.executemany(f"insert into compliance_intelligence.{table} ({','.join(fields)}) "
                               f"values ({','.join('?' for _ in fields)})",
                               [[row.get(field) for field in fields] for row in rows])


def populate_database(path, snapshot, selected=None, methodology=None, population_manifest=None):
    with duckdb.connect(str(path)) as con:
        con.execute(Path(__file__).with_name("schema.sql").read_text(encoding="utf-8"))
        con.execute("begin transaction")
        try:
            docs = [{**d, "last_verified_at": d["fetched_at"], "storage_ref": d["path"],
                     "access_status": d.get("access_status", "unknown"),
                     "reuse_status": "permitted" if d["source_id"] == snapshot["metadata"]["source_id"] and reviewed(snapshot['metadata'].get('reuse_review')) else "unverified"}
                    for d in snapshot["documents"]]
            insert_rows(con, "source_document", ("document_id", "source_id", "source_url", "publisher",
                "fetched_at", "document_hash", "content_type", "byte_count", "storage_ref",
                "access_status", "reuse_status", "last_verified_at"), docs)
            insert_rows(con, "dim_company", ("company_id", "organization_number", "registered_legal_name",
                "country_code", "registry_authority", "registry_number", "legal_form", "entity_kind",
                "identity_status", "source_document_id", "last_verified_at"), snapshot["companies"])
            reviews = []
            for c in snapshot["companies"]:
                if reviewed(c.get("identity_review")):
                    reviews.append(review_record("dim_company", c["company_id"], c, c["identity_review"]))
            for collection, table, id_field, extra in (
                ("aliases", "dim_company_alias", "alias_id", ("alias", "alias_type")),
                ("relationships", "company_relationship", "relationship_id", ("related_company_id", "relationship_type")),
            ):
                rows = [{**r, id_field: sha256(encoded(r)), "last_verified_at": r["review"]["reviewed_at"]}
                        for r in snapshot[collection]]
                insert_rows(con, table, (id_field, "company_id", *extra, "valid_from", "valid_to",
                    "source_document_id", "review_status", "last_verified_at"), rows)
                reviews.extend(review_record(table, row[id_field], row, row["review"]) for row in rows)
            insert_rows(con, "record_review", ("review_id", "target_table", "target_id", "record_hash",
                "review_kind", "review_status", "reviewer_id", "reviewed_at", "rationale"), reviews)
            if selected:
                definition = {**methodology, "target_size": 50, "methodology_json": encoded(methodology).decode(),
                    "population_document_id": selected[0]["source_document_id"],
                    "population_manifest_hash": sha256(encoded(population_manifest)),
                    "frozen_at": methodology["frozen_at"]}
                insert_rows(con, "cohort_definition", ("cohort_id", "as_of_date", "target_size", "methodology_version",
                    "methodology_json", "population_document_id", "population_manifest_hash", "selection_code_sha",
                    "frozen_at", "membership_hash"), [definition])
                insert_rows(con, "compliance_cohort", ("cohort_id", "company_id", "selection_rank",
                    "primary_sni_code", "sni_version", "employee_size_class", "size_class_order", "selection_document_id"),
                    [{**c, "selection_document_id": c["source_document_id"]} for c in selected])
            evidence = []
            for company in snapshot["companies"]:
                for field in ("organization_number", "registered_legal_name", "legal_form"):
                    if company[field] is not None:
                        evidence.append({"evidence_id": sha256(encoded([company, field])), "target_table": "dim_company",
                            "target_id": company["company_id"], "record_hash": sha256(encoded(company)), "field_name": field,
                            "document_id": company["source_document_id"],
                            "locator": company["source_locator"] + "; field=" + field,
                            "extraction_method": "structured", "extractor_version": POLICY["methodology_version"],
                            "observed_at": company["last_verified_at"]})
            insert_rows(con, "source_evidence", ("evidence_id", "target_table", "target_id", "record_hash", "field_name",
                "document_id", "locator", "extraction_method", "extractor_version", "observed_at"), evidence)
            con.execute("commit")
        except Exception:
            con.execute("rollback")
            raise


def review_record(table, target_id, record, review):
    return {"review_id": sha256(encoded([table, target_id, record, review])),
            "target_table": table, "target_id": target_id, "record_hash": sha256(encoded(record)),
            "review_kind": "identity", "review_status": "approved",
            "reviewer_id": review["reviewer_id"], "reviewed_at": review["reviewed_at"],
            "rationale": "Imported declared identity evidence review; original evidence is retained in the snapshot"}


def build_cohort(snapshot_dir, output, cohort_id, *, private_only=False):
    snapshot = load_snapshot(snapshot_dir)
    selected, methodology, exclusions = select_cohort(snapshot, cohort_id, private_only=private_only)
    methodology["frozen_at"] = now()
    population = {"metadata": snapshot["metadata"], "documents": snapshot["documents"]}
    methodology["population_manifest_hash"] = sha256(encoded(population))
    with new_output(output) as stage:
        for relative in ("snapshot.json", "evidence"):
            source = Path(snapshot_dir) / relative
            if source.is_dir():
                shutil.copytree(source, stage / relative)
            else:
                shutil.copyfile(source, stage / relative)
        write_json(stage / "cohort.json", selected)
        with (stage / "cohort.csv").open("w", encoding="utf-8", newline="") as stream:
            writer = csv.DictWriter(stream, fieldnames=list(selected[0]))
            writer.writeheader()
            writer.writerows(selected)
        write_json(stage / "methodology.json", methodology)
        write_json(stage / "population-manifest.json", population)
        write_json(stage / "exclusions.json", exclusions)
        write_json(stage / "identity-ambiguities.json", snapshot["conflicts"])
        write_json(stage / "aliases.json", snapshot["aliases"])
        write_json(stage / "relationships.json", snapshot["relationships"])
        populate_database(stage / "registry.duckdb", snapshot, selected, methodology, population)
        seal(stage)
    return methodology


def verify_cohort(directory):
    verify(directory)
    directory = Path(directory)
    snapshot = load_snapshot(directory)
    stored = json.loads((directory / "methodology.json").read_text(encoding="utf-8"))
    selected, calculated, _ = select_cohort(snapshot, stored["cohort_id"],private_only=stored.get('selection_scope')=='private_research')
    exported = json.loads((directory / "cohort.json").read_text(encoding="utf-8"))
    if stored["membership_hash"] != calculated["membership_hash"] or selected != exported:
        raise ValueError("Frozen cohort membership/attributes changed")
    for field, default in (('selection_scope','reuse_reviewed'),('source_reuse_status','reviewed')):
        if stored.get(field,default) != calculated[field]:
            raise ValueError('Frozen cohort selection/reuse scope changed')
    with duckdb.connect(str(directory / "registry.duckdb"), read_only=True) as con:
        actual = con.execute("""select company_id, selection_rank from compliance_intelligence.compliance_cohort
                                where cohort_id = ? order by selection_rank""", [stored["cohort_id"]]).fetchall()
        if actual != [(r["company_id"], r["selection_rank"]) for r in selected]:
            raise ValueError("Frozen DuckDB membership changed")
    return {"cohort_id": stored["cohort_id"], "selected_count": 50,
            "membership_hash": stored["membership_hash"], "verified": True,
            "selection_scope":stored.get('selection_scope','reuse_reviewed'),
            "source_reuse_status":stored.get('source_reuse_status','reviewed')}
