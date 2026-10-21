-- Ads per occupation field and year by employment type, working hours and whether
-- experience is required. All fields together are in mart_market_conditions_yearly_total.
select
    year(month) as year,
    coalesce(field_id, 'unknown') as field_id,
    employment_type,
    working_hours,
    experience_required,
    sum(ads)::bigint as ads,
    sum(vacancies)::bigint as vacancies
from {{ ref('stg_market_conditions') }}
group by all
