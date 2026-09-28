-- Ads per occupation field and year by employment type, working hours and whether
-- experience is required. field_id 'all' is every field together.
with base as (
    select year(month) as year, coalesce(field_id, 'unknown') as field_id,
           employment_type, working_hours, experience_required, ads, vacancies
    from {{ ref('stg_market_conditions') }}
)
select
    year,
    case when grouping(field_id) = 1 then 'all' else field_id end as field_id,
    employment_type,
    working_hours,
    experience_required,
    sum(ads)::bigint as ads,
    sum(vacancies)::bigint as vacancies
from base
group by grouping sets (
    (year, field_id, employment_type, working_hours, experience_required),
    (year, employment_type, working_hours, experience_required)
)
