-- Additive counts must add up over counties, but only where every county's value is
-- published: a sum over suppressed cells is a lower bound, not a total. AKU levels within
-- SCB's rounding (0.5 thousand); started F43 cases within ten cases or 0.5 per cent,
-- whichever is larger (a few cases have no county).
with aku as (
    select f.period_key, f.labour_status, f.sex_key,
           sum(f.persons_thousands) as county_sum, count(f.persons_thousands) as parts
    from {{ ref('fct_labour_force') }} as f
    join {{ ref('dim_region') }} as r using (region_code)
    where r.region_level = 'county' and f.series_type = 'unadjusted'
    group by all
), stress as (
    select period_key, sex_key, sum(cases) as county_sum, count(cases) as parts
    from {{ ref('fct_sick_leave_cases') }}
    where diagnosis_code = 'F43' and region_code <> '00'
    group by all
)
select 'aku' as check_name, a.period_key, a.county_sum, n.persons_thousands as national
from aku as a
join {{ ref('fct_labour_force') }} as n
    on n.region_code = '00' and n.period_key = a.period_key and n.labour_status = a.labour_status
   and n.sex_key = a.sex_key and n.series_type = 'unadjusted' and n.age_group_key = '15-74'
where a.parts = 21 and abs(a.county_sum - n.persons_thousands) > 0.5
union all
select 'f43', s.period_key, s.county_sum, n.cases
from stress as s
join {{ ref('fct_sick_leave_cases') }} as n
    on n.diagnosis_code = 'F43' and n.region_code = '00' and n.period_key = s.period_key and n.sex_key = s.sex_key
where s.parts = 21 and abs(s.county_sum - n.cases) > greatest(10, 0.005 * n.cases)
