-- Sick-leave cases conformed. Started cases have no age breakdown (ALL); ongoing cases are
-- counted from age 16, which is what FK's 'ALL' means there.
select
    case_type,
    case when county_code = 'ALL' then '00' else county_code end as region_code,
    format('{:04d}-{:02d}', year, month) as period_key,
    make_date(year, month, 1) as period_start,
    {{ welfare_sex_key('sex_code') }} as sex_key,
    case
        when case_type = 'started' then 'ALL'
        when age_code = 'ALL' then '16+'
        when age_code like '%-' then rtrim(age_code, '-') || '+'
        else age_code
    end as age_group_key,
    case when diagnosis_code like 'ALL%' then 'ALL' else diagnosis_code end as diagnosis_code,
    cases,
    cases_suppressed,
    yoy_change_pct
from {{ ref('stg_fk_sick_leave_cases') }}
