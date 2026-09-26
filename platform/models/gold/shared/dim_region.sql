-- Swedish regions on SCB's codes: the country (00), counties (two digits), municipalities
-- (four digits, the first two being the county), AKU's aggregate 0050, and the eight NUTS2
-- areas (SE11..SE33) that ESS reports. Each row carries its county, NUTS2 area and Kolada id.
with scb as (
    select region_code, region_name from {{ ref('stg_scb_regions') }}
    union
    select region_code, region_name from {{ ref('stg_scb_aku_regions') }}
), levelled as (
    select
        region_code,
        region_name,
        case
            when region_code = '00' then 'country'
            when length(region_code) = 2 then 'county'
            when region_code = '0050' then 'aggregate'
            else 'municipality'
        end as region_level
    from scb
), counties as (
    select region_code as county_code, region_name as county_name
    from levelled where region_level = 'county'
), nuts2 as (
    select distinct nuts2_code, nuts2_name from {{ ref('region_nuts') }}
)
select
    l.region_code,
    l.region_name,
    l.region_level,
    c.county_code,
    c.county_name,
    n.nuts2_code,
    n.nuts2_name,
    case l.region_level
        when 'country' then '0000'
        when 'county' then '00' || l.region_code
        when 'municipality' then l.region_code
    end as kolada_region_id
from levelled as l
left join counties as c
    on l.region_level in ('county', 'municipality') and c.county_code = left(l.region_code, 2)
left join {{ ref('region_nuts') }} as n on n.county_code = c.county_code
union all
select nuts2_code, nuts2_name, 'nuts2', null, null, nuts2_code, nuts2_name, null
from nuts2
