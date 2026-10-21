-- One row per library in Biblioteksdatabasen, in the dump's order (file, then position). Only
-- what SWEDEN D uses; no contact details.
with files as (
    select filename, unnest(json_extract(content, '$.libraries[*]')) as l,
           generate_subscripts(json_extract(content, '$.libraries[*]'), 1) as position
    from {{ source('kb', 'libraries') }}
)
select
    l ->> 'sigel' as sigel,
    l ->> 'name' as name,
    l ->> 'municipality_code' as municipality_code,
    l ->> 'library_type' as library_type,
    cast(l ->> 'alive' as boolean) as alive,
    l ->> 'country_code' as country_code,
    cast(l ->> 'longitude' as double) as longitude,
    cast(l ->> 'latitude' as double) as latitude,
    row_number() over (order by filename, position) as dump_order
from files
