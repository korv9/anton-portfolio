-- Ads per month and occupation field, summed over archives (an archive covers a year or a
-- quarter; a month can straddle two when ads are republished, so counts are summed).
select
    cast(publication_month || '-01' as date) as month,
    field_id,
    any_value(field) as field,
    sum(ads) as ads
from {{ source('jobtech_governance', 'totals') }}
-- A few ads carry impossible publication dates (2051, 2099); months after the build date are left out.
where publication_month >= '2020-01' and publication_month <= strftime(current_date, '%Y-%m')
group by 1, 2
