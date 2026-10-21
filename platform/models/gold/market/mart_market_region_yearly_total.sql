-- Ads per county and year over every occupation field, in full and year to date: the sum of
-- mart_market_region_yearly over its fields.
select
    year,
    region,
    sum(ads)::bigint as ads,
    sum(vacancies)::bigint as vacancies,
    sum(ads_ytd)::bigint as ads_ytd
from {{ ref('mart_market_region_yearly') }}
group by year, region
