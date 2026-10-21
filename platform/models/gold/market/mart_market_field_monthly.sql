-- New ads and vacancies per month in each occupation field. The whole market, with the ads
-- without a field (about 0.02 %), is in mart_market_field_monthly_total. A month counted from the
-- daily stream rather than an archive is preliminary.
select
    a.month, a.field_id, f.field,
    sum(a.ads)::bigint as ads,
    sum(a.vacancies)::bigint as vacancies,
    bool_or(a.archive = 'stream') as preliminary
from {{ ref('stg_market_ads') }} as a
join {{ ref('dim_market_field') }} as f using (field_id)
group by all
