-- New ads and vacancies per month over the whole market, ads without an occupation field
-- included, so more than the sum of mart_market_field_monthly. Preliminary as there.
select
    month,
    sum(ads)::bigint as ads,
    sum(vacancies)::bigint as vacancies,
    bool_or(archive = 'stream') as preliminary
from {{ ref('stg_market_ads') }}
group by month
