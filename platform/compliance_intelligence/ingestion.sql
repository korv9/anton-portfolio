-- Private acquisition database. Never install this in portfolio.duckdb.
create schema if not exists bronze;
create schema if not exists silver;
create schema if not exists gold;
create table if not exists bronze.ingestion_run (
    run_id varchar primary key, started_at timestamptz not null,
    finished_at timestamptz, configuration json not null, report json
);
create table if not exists bronze.document_version (
    document_id varchar primary key, source_id varchar not null,
    authority varchar not null, source_url varchar not null,
    document_hash varchar not null check (regexp_full_match(document_hash, '[a-f0-9]{64}')),
    content_type varchar not null, byte_count bigint not null,
    first_fetched_at timestamptz not null, storage_ref varchar,
    reuse_status varchar not null, copy_review json,
    privacy_status varchar default 'unreviewed',
    unique(source_id, source_url, document_hash)
);
create table if not exists bronze.resource (
    source_id varchar, source_url varchar, document_id varchar not null,
    etag varchar, last_modified varchar, last_verified_at timestamptz not null,
    primary key(source_id, source_url)
);
create table if not exists bronze.fetch (
    fetch_id varchar primary key, run_id varchar not null, source_id varchar not null,
    source_url varchar not null, fetched_at timestamptz not null,
    status_code integer, attempt integer not null, response_metadata json,
    document_id varchar, previous_document_id varchar, changed boolean,
    error_code varchar
);
create table if not exists bronze.robots_observation (
    run_id varchar, source_id varchar, source_url varchar, checked_at timestamptz,
    document_hash varchar, status_code integer, rules json,
    primary key(run_id, source_id)
);
create table if not exists silver.document_extraction (
    document_id varchar, extraction_version varchar, extracted_at timestamptz not null,
    publication_date date, decision_date date, case_reference varchar,
    review_status varchar default 'unreviewed', payload json not null,
    primary key(document_id, extraction_version)
);
create table if not exists silver.discovery (
    run_id varchar, source_id varchar, source_url varchar, kind varchar,
    parent_document_id varchar not null, label varchar, status varchar not null,
    primary key(run_id, source_id, source_url, kind, parent_document_id)
);
create table if not exists silver.company_mention (
    run_id varchar, document_id varchar, mention_index integer,
    company_id varchar, candidate_ids json not null, resolution json not null,
    review_status varchar default 'unreviewed',
    primary key(run_id, document_id, mention_index)
);
create or replace view gold.ingestion_coverage as
select run_id, source_id, count(*) as fetch_attempts,
       count(*) filter (where error_code is not null) as failed_attempts,
       count(distinct document_id) as observed_versions
from bronze.fetch group by run_id, source_id;
