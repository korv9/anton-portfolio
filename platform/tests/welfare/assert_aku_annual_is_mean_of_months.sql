-- SCB forms AKU annual figures from the months. The rule for a rate over time: average the
-- monthly levels, then divide. For the country that must match the published annual
-- unemployment rate within 0.1 percentage points (it does within 0.07 for 2001-2025).
with months as (
    select left(period_key, 4) as period_key, labour_status, avg(persons_thousands) as level, count(*) as months
    from {{ ref('fct_labour_force') }}
    where region_code = '00' and series_type = 'unadjusted' and sex_key = 'T'
      and age_group_key = '15-74' and length(period_key) = 7
    group by all
), rates as (
    select period_key,
           100 * max(level) filter (where labour_status = 'unemployed')
               / max(level) filter (where labour_status = 'labour_force') as rate
    from months
    where months = 12
    group by period_key
)
select r.period_key, r.rate, p.rate_pct
from rates as r
join {{ ref('fct_labour_force') }} as p
    on p.region_code = '00' and p.period_key = r.period_key and p.labour_status = 'unemployed'
   and p.sex_key = 'T' and p.age_group_key = '15-74' and p.series_type = 'unadjusted'
where abs(r.rate - p.rate_pct) > 0.1
