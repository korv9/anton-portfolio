-- One row per bibstat observation: term, library (sigel), year, target group and value. A value
-- that is absent or not a number stays NULL here; gold decides what that means.
with files as (
    select
        regexp_extract(filename, '([A-Za-z0-9]+)\.json$', 1) as term,
        unnest(json_extract(content, '$.observations[*]')) as o
    from {{ source('kb', 'statistics') }}
)
select
    o ->> '$."@id"' as observation_id,
    term,
    regexp_extract(o ->> '$.library."@id"', '[^/]+$') as sigel,
    cast(o ->> 'sampleYear' as integer) as sample_year,
    o ->> 'targetGroup' as target_group,
    case when json_type(o -> term) in ('BIGINT', 'UBIGINT', 'DOUBLE')
        then cast(o ->> term as double) end as value
from files
