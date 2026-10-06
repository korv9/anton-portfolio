-- New ads and vacancies per month in each occupation field, and for the whole market
-- (field_id 'all'). Ads without a field (about 0.02 %) count only in the total. A month counted
-- from the daily stream rather than an archive is preliminary.
with fields as (
    select a.month, a.field_id, f.field, sum(a.ads) as ads, sum(a.vacancies) as vacancies,
           bool_or(a.archive = 'stream') as preliminary
    from {{ ref('stg_market_ads') }} as a
    join {{ ref('dim_market_field') }} as f using (field_id)
    group by all
), total as (
    select month, 'all' as field_id, 'Hela arbetsmarknaden' as field,
           sum(ads) as ads, sum(vacancies) as vacancies,
           bool_or(archive = 'stream') as preliminary
    from {{ ref('stg_market_ads') }}
    group by all
)
select month, field_id, field, ads::bigint as ads, vacancies::bigint as vacancies, preliminary
from fields
union all
select month, field_id, field, ads::bigint, vacancies::bigint, preliminary from total
