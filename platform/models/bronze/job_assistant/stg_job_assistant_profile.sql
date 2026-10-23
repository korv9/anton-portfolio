-- The approved profile version the matches used and the run's Workers AI note; no row without a profile.
select
    cast(json -> 'profile' ->> 'version' as integer) as profile_version,
    json -> 'profile' ->> 'cv_sha256' as cv_sha256,
    json -> 'profile' ->> 'profile_sha256' as profile_sha256,
    cast(json -> 'profile' ->> 'approved_at' as timestamptz) as approved_at,
    json ->> 'engine' as engine,
    cast(json -> 'note' ->> 'at' as timestamptz) as matched_at,
    try_cast(json -> 'note' ->> 'neurons_before' as double) as neurons_before,
    try_cast(json -> 'note' ->> 'neurons_after' as double) as neurons_after,
    coalesce(try_cast(json -> 'note' -> 'embeddings' ->> 'embedded' as integer), 0) as embedded,
    coalesce(try_cast(json -> 'note' -> 'embeddings' ->> 'missing' as integer), 0) as embeddings_missing,
    json -> 'note' -> 'embeddings' ->> 'stopped' as embeddings_stopped,
    coalesce(try_cast(json -> 'note' ->> 'explained' as integer), 0) as explained
from {{ source('job_assistant', 'matches') }}
where (json ->> 'profile') is not null
