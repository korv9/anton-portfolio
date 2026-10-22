-- A table, rebuilt in full: its only build (platform/ingest/jobtech/run_history_pipeline.py)
-- passes --full-refresh, so an incremental strategy never ran.
{{ config(materialized='table') }}

select job_id, employer_id, location_id, occupation_id, title,
    published_at, last_application_date, employment_type, role_family, seniority,
    ingestion_id, ingested_at, source_kind,
    classification_basis, role_match_count, number_of_vacancies, original_id
from {{ ref('int_job_ads_enriched') }}
