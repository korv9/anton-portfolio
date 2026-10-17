"""Offline checks for the Phase 0 contracts; all rows below are synthetic."""
import hashlib
import sys
from datetime import datetime, timezone
from pathlib import Path

import duckdb
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from compliance_intelligence.contracts import RetrievedDocument, open_contract_database  # noqa: E402


@pytest.fixture
def contract():
    with open_contract_database() as connection:
        connection.execute("set schema = 'compliance_intelligence'")
        connection.execute("""
            insert into source_document
                (document_id, source_id, source_url, publisher, fetched_at, document_hash,
                 content_type, byte_count, last_verified_at)
            values ('doc', 'synthetic', 'https://example.invalid/decision', 'Synthetic authority',
                    now(), repeat('a', 64), 'application/pdf', 1, now());
            insert into legal_case
                (case_id, authority, authority_case_number, jurisdiction_country,
                 case_type, source_document_id, last_verified_at)
            values ('case', 'synthetic-authority', 'TEST/1', 'SE', 'data_protection', 'doc', now());
        """)
        yield connection


def insert_decision(connection, *, kind="administrative", outcome="administrative_sanction",
                    amount=None, currency=None, finality="unknown", appeal="unknown"):
    connection.execute("""
        insert into legal_decision
            (decision_id, case_id, decision_kind, outcome_type, sanction_amount, currency,
             finality_status, appeal_status, source_document_id, last_verified_at)
        values ('decision', 'case', ?, ?, ?, ?, ?, ?, 'doc', now())
    """, [kind, outcome, amount, currency, finality, appeal])


def test_contract_is_empty_and_has_no_automatic_pipeline_registration():
    with open_contract_database() as connection:
        tables = connection.execute("""
            select table_name from information_schema.tables
            where table_schema = 'compliance_intelligence'
        """).fetchall()
        assert len(tables) == 13
        for (table,) in tables:
            assert connection.execute(f'select count(*) from compliance_intelligence.{table}').fetchone() == (0,)
        assert connection.execute("pragma database_list").fetchone()[2] is None
    registry = Path(__file__).resolve().parents[2] / "pipeline.yml"
    assert "compliance_intelligence" not in registry.read_text(encoding="utf-8")


def test_hash_preserves_original_bytes():
    document = RetrievedDocument("synthetic", "https://example.invalid", "Synthetic",
                                 datetime.now(timezone.utc), "text/plain", b"line\r\n")
    assert document.document_hash == hashlib.sha256(b"line\r\n").hexdigest()
    assert document.document_hash != hashlib.sha256(b"line\n").hexdigest()


def test_unknown_finality_and_review_are_preserved(contract):
    insert_decision(contract)
    assert contract.execute("""
        select appeal_status, finality_status, review_status, sanction_amount
        from legal_decision
    """).fetchone() == ("unknown", "unknown", "unreviewed", None)


@pytest.mark.parametrize("kwargs", [
    {"outcome": "criminal_conviction"},
    {"outcome": "acquittal"},
    {"kind": "criminal_judgment"},
    {"amount": -1, "currency": "SEK"},
    {"amount": 100},
    {"currency": "SEK"},
    {"finality": "final"},
    {"finality": "final", "appeal": "pending"},
])
def test_invalid_legal_states_are_rejected(contract, kwargs):
    with pytest.raises(duckdb.ConstraintException):
        insert_decision(contract, **kwargs)


def test_explicit_court_outcome_does_not_imply_finality(contract):
    contract.execute("update legal_case set case_type = 'criminal' where case_id = 'case'")
    insert_decision(contract, kind="criminal_judgment", outcome="criminal_conviction")
    assert contract.execute("select outcome_type, finality_status from legal_decision").fetchone() == (
        "criminal_conviction", "unknown")


def test_finding_requires_a_decision_and_cannot_link_another_case(contract):
    with pytest.raises(duckdb.ConstraintException):
        contract.execute("""
            insert into case_event (event_id, case_id, event_type, recorded_at, source_document_id)
            values ('finding', 'case', 'regulatory_finding', now(), 'doc')
        """)
    insert_decision(contract)
    contract.execute("""
        insert into legal_case values
            ('other-case', 'other-authority', 'TEST/1', 'SE', 'competition', 'unknown', 'doc', now())
    """)
    with pytest.raises(duckdb.ConstraintException):
        contract.execute("""
            insert into case_event (event_id, case_id, decision_id, event_type, recorded_at, source_document_id)
            values ('wrong-case', 'other-case', 'decision', 'administrative_sanction', now(), 'doc')
        """)


def test_approval_requires_a_named_reviewer(contract):
    with pytest.raises(duckdb.ConstraintException):
        contract.execute("""
            insert into record_review
                (review_id, target_table, target_id, record_hash, review_kind, review_status, rationale)
            values ('review', 'legal_decision', 'decision', repeat('b', 64), 'publication', 'approved', 'Test')
        """)


def test_coverage_is_unknown_until_a_search_is_recorded(contract):
    contract.execute("""
        insert into dim_company
            (company_id, organization_number, registered_legal_name, country_code,
             registry_authority, registry_number, legal_form, source_document_id, last_verified_at)
        values ('synthetic-company', '5599999999', 'Synthetic company AB', 'SE', 'synthetic',
                '5599999999', 'AB', 'doc', now())
    """)
    with pytest.raises(duckdb.ConstraintException):
        contract.execute("""
            insert into coverage_observation
                (coverage_id, company_id, source_id, window_start, window_end,
                 search_status, limitations)
            values ('coverage', 'synthetic-company', 'synthetic', '2020-01-01', '2020-12-31',
                    'complete', 'Synthetic test')
        """)
    insert_decision(contract)
    with pytest.raises(duckdb.ConstraintException):
        contract.execute("""
            insert into decision_company
                (decision_id, company_id, party_role, source_document_id)
            values ('decision', 'synthetic-company', 'sanctioned_party', 'doc')
        """)
