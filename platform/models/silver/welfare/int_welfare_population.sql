-- Population by region, year and sex. SCB publishes women and men; the total (T) is their
-- sum, marked `is_derived_total`, so every fact can join on sex T. `is_perturbed` marks
-- years published under the cell key method (see stg_scb_population).
with by_sex as (
    select region_code, cast(year as varchar) as period_key, make_date(year, 12, 31) as period_end,
           {{ welfare_sex_key('sex_code') }} as sex_key, population,
           false as is_derived_total, is_perturbed
    from {{ ref('stg_scb_population') }}
)
select * from by_sex
union all
select region_code, period_key, any_value(period_end), 'T', sum(population), true, bool_or(is_perturbed)
from by_sex
group by region_code, period_key
having count(*) = 2 and count(population) = 2
