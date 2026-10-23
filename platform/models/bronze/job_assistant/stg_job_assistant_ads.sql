-- One row per JobTech ad id the job assistant has seen. Source times without an offset are
-- Stockholm local time, as JobTech writes them; first_seen is the UTC time of the fetch.
select
    json ->> 'id' as ad_id,
    json ->> 'headline' as headline,
    json ->> 'employer' as employer,
    json ->> 'organisation_number' as organisation_number,
    json ->> 'municipality' as municipality,
    json ->> 'region' as region,
    json ->> 'country_code' as country_code,
    json ->> 'occupation' as occupation,
    json ->> 'employment_type' as employment_type,
    json ->> 'working_hours' as working_hours,
    json ->> 'description' as description,
    json ->> 'text_origin' as text_origin,
    cast(json ->> 'contact_redactions' as integer) as contact_redactions,
    coalesce(from_json(json -> 'must_have', '["VARCHAR"]'), []) as must_have,
    coalesce(from_json(json -> 'nice_to_have', '["VARCHAR"]'), []) as nice_to_have,
    json ->> 'source_url' as source_url,
    json ->> 'application_url' as application_url,
    try_cast(json ->> 'application_deadline' as timestamp) as application_deadline,
    try_cast(json ->> 'published' as timestamp) as published,
    try_cast(json ->> 'changed' as timestamp) as changed,
    cast(json ->> 'first_seen' as timestamptz) as first_seen,
    try_cast(json ->> 'removed_at' as timestamp) as removed_at,
    json ->> 'duplicate_of' as duplicate_of,
    json ->> 'content_hash' as content_hash,
    json -> 'history' as history
from {{ source('job_assistant', 'ads') }}
