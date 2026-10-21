-- Ads per county, occupation field and year, in full and year to date (see
-- mart_market_occupation_yearly). All fields together are in mart_market_region_yearly_total.
with periods as (select * from {{ ref('int_market_periods') }}),
base as (
    select year(a.month) as year, a.region, coalesce(a.field_id, 'unknown') as field_id,
           a.month, a.ads, a.vacancies
    from {{ ref('stg_market_ads') }} as a
), by_field as (
    select year, region, field_id,
           sum(ads) as ads, sum(vacancies) as vacancies,
           sum(ads) filter (where month(month) <= (select last_month_of_latest_year from periods)) as ads_ytd
    from base
    group by year, region, field_id
)
select
    year,
    region,
    field_id,
    ads::bigint as ads,
    vacancies::bigint as vacancies,
    coalesce(ads_ytd, 0)::bigint as ads_ytd
from by_field
