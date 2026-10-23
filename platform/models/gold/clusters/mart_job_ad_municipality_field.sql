-- Ads per year × municipality × occupation field, JobTech's names mapped to SCB codes through
-- the current codes of dim_municipality and the 2023 field labels harmonised through
-- occupation_field_crosswalk. share is the field's share of the municipality's ads that year.
-- Ads whose name does not map are counted in mart_job_ad_unmatched_municipalities.
with ads as (
    select a.year, a.municipality, coalesce(x.field, a.occupation_field) as occupation_field, sum(a.ads) as ads
    from {{ ref('stg_job_ad_municipality_field') }} as a
    left join {{ ref('occupation_field_crosswalk') }} as x on x.label = a.occupation_field
    group by all
)
select
    a.year, m.municipality_code, m.municipality_name, a.occupation_field, a.ads,
    a.ads / sum(a.ads) over (partition by a.year, m.municipality_code) as share
from ads as a
join {{ ref('dim_municipality') }} as m
    on m.municipality_name = a.municipality and m.valid_to is null
