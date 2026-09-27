-- The aggregation rule for sjukpenningtal: sum sick_pay_days and insured_persons, then divide.
-- Applied to each county's municipalities it must give FK's published county rate, within
-- FK's rounding of the rate to two decimals. If this fails, the component is wrong.
with recomputed as (
    select r.county_code as region_code, f.period_key, f.sex_key, f.age_group_key,
           sum(f.sick_pay_days) / sum(f.insured_persons) as rate
    from {{ ref('fct_sick_pay_rate') }} as f
    join {{ ref('dim_region') }} as r using (region_code)
    where r.region_level = 'municipality'
    group by all
    having count(f.sick_pay_days) = count(*)
)
select c.region_code, c.period_key, c.sex_key, c.age_group_key, c.sick_pay_rate, r.rate
from recomputed as r
join {{ ref('fct_sick_pay_rate') }} as c using (region_code, period_key, sex_key, age_group_key)
where abs(r.rate - c.sick_pay_rate) > 0.02
