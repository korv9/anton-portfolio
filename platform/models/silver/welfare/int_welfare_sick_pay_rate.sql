-- Sjukpenningtal 2.0 conformed. FK encodes the country as ALL_ALL, a county total as
-- ALL_<county> and a municipality by its SCB code; age classes are named by their upper
-- bound ('19' is 15-19).
select
    case when municipality_code = 'ALL_ALL' then '00'
         when municipality_code like 'ALL\_%' escape '\' then substr(municipality_code, 5)
         else municipality_code end as region_code,
    format('{:04d}-{:02d}', year, month) as period_key,
    {{ welfare_sex_key('sex_code') }} as sex_key,
    case when age_code = 'ALL' then '15-69'
         else cast(cast(age_code as integer) - 4 as varchar) || '-' || age_code end as age_group_key,
    sick_pay_rate,
    sick_pay_rate_suppressed,
    insured_persons,
    insured_persons_suppressed
from {{ ref('stg_fk_sick_pay_rate') }}
