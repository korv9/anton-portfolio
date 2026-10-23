-- One row per matched ad, unpacked from rank.py's match store. No approved profile means no rows.
with store as (
    select json from {{ source('job_assistant', 'matches') }}
),
rows as (
    select unnest(from_json(json -> 'matches', '["JSON"]')) as m from store
)
select
    m ->> 'id' as ad_id,
    cast(m ->> 'rank' as integer) as rank,
    m ->> 'class' as match_class,
    m ->> 'role' as role,
    cast(m ->> 'role_from_title' as boolean) as role_from_title,
    from_json(m -> 'reasons', '["VARCHAR"]') as reasons,
    coalesce(from_json(m -> 'gaps', '["VARCHAR"]'), []) as gaps,
    coalesce(from_json(m -> 'uncertain', '["VARCHAR"]'), []) as uncertain,
    try_cast(m ->> 'similarity' as double) as similarity,
    m ->> 'remote' as remote_quote,
    m -> 'seniority' ->> 'title' as senior_title,
    try_cast(m -> 'seniority' ->> 'years' as integer) as years_asked,
    m -> 'seniority' ->> 'junior' as junior_quote,
    m -> 'explanation' ->> 'status' as explanation_status,
    m -> 'explanation' ->> 'text' as explanation,
    m -> 'explanation' ->> 'model' as explanation_model,
    m ->> 'content_hash' as content_hash,
    cast(m ->> 'profile_version' as integer) as profile_version,
    m ->> 'cv_sha256' as cv_sha256,
    m ->> 'engine' as engine,
    m -> 'skills' as skills,
    m -> 'checks' as checks
from rows
