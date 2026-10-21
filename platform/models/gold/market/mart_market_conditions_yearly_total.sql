-- Ads per year by employment type, working hours and required experience over every occupation
-- field: the sum of mart_market_conditions_yearly over its fields.
select
    year,
    employment_type,
    working_hours,
    experience_required,
    sum(ads)::bigint as ads,
    sum(vacancies)::bigint as vacancies
from {{ ref('mart_market_conditions_yearly') }}
group by all
