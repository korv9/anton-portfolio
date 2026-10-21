-- One row per SCB municipality code in use since 1974: today's 290 from dim_region, and the
-- 51 codes retired by the 1977 Bara merger and the 1997, 1998 and 2007 renumberings
-- (seeds/shared/municipality_codes). A retired code carries its successor and the
-- successor's county, NUTS2 area and name; only Bara has a name of its own.
with codes as (
    select * from {{ ref('municipality_codes') }}
), current_codes as (
    select
        r.region_code as municipality_code,
        r.region_name as municipality_name,
        r.county_code,
        r.county_name,
        r.nuts2_code,
        r.nuts2_name,
        r.kolada_region_id,
        coalesce(c.valid_from, 1974) as valid_from,
        cast(null as integer) as valid_to,
        cast(null as varchar) as successor_code,
        cast(null as varchar) as change_type
    from {{ ref('dim_region') }} as r
    left join codes as c on c.municipality_code = r.region_code
    where r.region_level = 'municipality'
)
select * from current_codes
union all
select
    c.municipality_code,
    c.retired_name,
    s.county_code,
    s.county_name,
    s.nuts2_code,
    s.nuts2_name,
    null,
    c.valid_from,
    c.valid_to,
    c.successor_code,
    c.change_type
from codes as c
left join current_codes as s on s.municipality_code = c.successor_code
where c.valid_to is not null
