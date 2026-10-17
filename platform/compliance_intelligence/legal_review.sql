create schema if not exists review;
create table if not exists review.candidate (
    record_hash varchar primary key, record_id varchar not null, document_id varchar not null,
    case_id varchar, created_at timestamptz not null, payload json not null,
    identity_match json not null, registry_hash varchar, completeness json not null
);
create table if not exists review.current_record (
    record_id varchar primary key, record_hash varchar not null
);
create table if not exists review.decision_link (
    source_record_hash varchar, target_record_id varchar, target_record_hash varchar,
    relation varchar not null, evidence json not null,
    primary key(source_record_hash, target_record_id, relation)
);
create table if not exists review.action (
    action_id varchar primary key, record_hash varchar not null, context_hash varchar not null,
    review_kind varchar not null check(review_kind in ('identity','legal','privacy','publication')),
    disposition varchar not null check(disposition in ('approved','rejected','withdrawn')),
    reviewer_id varchar not null, reviewed_at timestamptz not null,
    verified_at timestamptz, reverify_by date, rationale varchar not null,
    payload json not null, audit_sequence bigint not null unique
);
create table if not exists review.pending_link (
    source_record_hash varchar, target_record_id varchar, target_record_hash varchar,
    reason varchar not null, evidence json not null,
    primary key(source_record_hash,target_record_id)
);
create table if not exists review.audit_log (
    sequence bigint primary key, recorded_at timestamptz not null,
    event_type varchar not null, payload json not null, previous_hash varchar,
    event_hash varchar not null unique
);
create table if not exists review.evidence_access (
    access_id varchar primary key, document_id varchar not null,
    checked_at timestamptz not null, method varchar not null,
    matched_hash boolean, result varchar not null
);
create or replace view review.case_groups as
select case_id, count(distinct record_id) as document_decision_count
from review.candidate c join review.current_record h using(record_id,record_hash)
where case_id is not null group by case_id;
