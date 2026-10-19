-- The region codes each regional SCB table reports, counted by code shape: two digits are
-- counties, four digits municipalities, longer codes areas below a municipality (DeSO, RegSO).
with files as (
    select
        regexp_extract(filename, '([A-Za-z0-9_]+)\.json$', 1) as table_id,
        content::json as j
    from {{ source('catalogue', 'scb_metadata') }}
),

dimensions as (
    select table_id, j, unnest(json_keys(j -> 'dimension')) as dimension_id
    from files
),

regional as (
    select table_id, dimension_id, j -> 'dimension' -> dimension_id -> 'category' -> 'index' as idx
    from dimensions
    where list_contains(coalesce(json_extract_string(j, '$.role.geo[*]'), []), dimension_id)
       or lower(json_extract_string(j -> 'dimension' -> dimension_id, '$.label')) like '%region%'
),

codes as (
    select table_id, unnest(json_keys(idx)) as code from regional
)

select
    table_id,
    count(*) as region_codes,
    count(*) filter (where regexp_full_match(code, '[0-9]{2}') and code <> '00') as county_codes,
    count(*) filter (where regexp_full_match(code, '[0-9]{4}')) as municipality_codes,
    count(*) filter (where length(code) > 4) as subarea_codes
from codes
group by table_id
