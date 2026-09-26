-- Every age band any welfare fact uses. Bands overlap across sources (AKU 15-74, FK 15-69,
-- Folkhälsomyndigheten 16-84) and are kept as published: a band is only comparable to the
-- same band. ALL marks a source that does not break its count down by age.
with used as (
    select age_group_key from {{ ref('int_welfare_labour_force') }}
    union select age_group_key from {{ ref('int_welfare_sick_pay_rate') }}
    union select age_group_key from {{ ref('int_welfare_sick_leave_cases') }}
    union select age_group_key from {{ ref('int_welfare_health_survey') }}
    union select age_group_key from {{ ref('int_welfare_ess_answers') }} where age_group_key is not null
    union select 'ALL'
    union select '15+'
)
select
    age_group_key,
    case
        when age_group_key = 'ALL' then null
        else cast(regexp_extract(age_group_key, '^(\d+)', 1) as integer)
    end as age_min,
    case
        when regexp_full_match(age_group_key, '\d+-\d+')
            then cast(regexp_extract(age_group_key, '-(\d+)$', 1) as integer)
    end as age_max,
    case
        when age_group_key = 'ALL' then 'Alla åldrar'
        when age_group_key like '%+' then rtrim(age_group_key, '+') || ' år och äldre'
        else replace(age_group_key, '-', '–') || ' år'
    end as age_group_label
from used
