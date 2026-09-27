-- Sjukpenningtal 2.0 conformed, with the rate's additive component. FK encodes the country as ALL_ALL, a county total as
-- ALL_<county> and a municipality by its SCB code; age classes are named by their upper
-- bound ('19' is 15-19).
select
    case when municipality_code = 'ALL_ALL' then '00'
         when municipality_code like 'ALL\_%' escape '\' then substr(municipality_code, 5)
         else municipality_code end as region_code,
    format('{:04d}-{:02d}', year, month) as period_key,
    make_date(year, month, 1) as period_start,
    {{ welfare_sex_key('sex_code') }} as sex_key,
    case when age_code = 'ALL' then '15-69'
         else cast(cast(age_code as integer) - 4 as varchar) || '-' || age_code end as age_group_key,
    sick_pay_rate,
    sick_pay_rate_suppressed,
    insured_persons,
    insured_persons_suppressed,
    -- The additive component: net days over the twelve months. Sum it with insured_persons
    -- over regions, ages or sexes and divide to get a correct combined rate. FK rounds the
    -- rate to two decimals, so the days carry that rounding.
    sick_pay_rate * insured_persons as sick_pay_days
from {{ ref('stg_fk_sick_pay_rate') }}
