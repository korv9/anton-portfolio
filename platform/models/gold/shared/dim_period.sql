-- Every reporting period any welfare fact uses, with its start and end date. Sources
-- report at different grains, so a fact carries a period, not a date:
--   year 2024 | quarter 2024-Q1 | month 2024-03 | pooled_years 2021-2024 | survey_round ESS11
-- `reference_year` is the year a period is compared under: the year itself, the last year
-- of a pooled period, and an ESS round's nominal year.
with used as (
    select period_key from {{ ref('int_welfare_labour_force') }}
    union select period_key from {{ ref('int_welfare_population') }}
    union select period_key from {{ ref('int_welfare_sick_pay_rate') }}
    union select period_key from {{ ref('int_welfare_sick_leave_cases') }}
    union select period_key from {{ ref('int_welfare_health_survey') }}
    union select period_key from {{ ref('int_welfare_kolada') }}
    union select period_key from {{ ref('int_welfare_ess_answers') }}
), typed as (
    select
        period_key,
        case
            when regexp_full_match(period_key, '\d{4}') then 'year'
            when regexp_full_match(period_key, '\d{4}-Q[1-4]') then 'quarter'
            when regexp_full_match(period_key, '\d{4}-\d{2}') then 'month'
            when regexp_full_match(period_key, '\d{4}-\d{4}') then 'pooled_years'
            when regexp_full_match(period_key, 'ESS\d+') then 'survey_round'
        end as period_type
    from used
)
select
    t.period_key,
    t.period_type,
    case t.period_type
        when 'year' then make_date(cast(t.period_key as integer), 1, 1)
        when 'quarter' then make_date(cast(left(t.period_key, 4) as integer),
                                      cast(right(t.period_key, 1) as integer) * 3 - 2, 1)
        when 'month' then cast(t.period_key || '-01' as date)
        when 'pooled_years' then make_date(cast(left(t.period_key, 4) as integer), 1, 1)
        when 'survey_round' then make_date(cast(left(r.fieldwork_label, 4) as integer), 1, 1)
    end as start_date,
    case t.period_type
        when 'year' then make_date(cast(t.period_key as integer), 12, 31)
        when 'quarter' then last_day(make_date(cast(left(t.period_key, 4) as integer),
                                               cast(right(t.period_key, 1) as integer) * 3, 1))
        when 'month' then last_day(cast(t.period_key || '-01' as date))
        when 'pooled_years' then make_date(cast(right(t.period_key, 4) as integer), 12, 31)
        when 'survey_round' then make_date(cast(right(r.fieldwork_label, 4) as integer), 12, 31)
    end as end_date,
    case t.period_type
        when 'pooled_years' then cast(right(t.period_key, 4) as integer)
        when 'survey_round' then r.reference_year
        else cast(left(t.period_key, 4) as integer)
    end as reference_year,
    case t.period_type
        when 'survey_round' then t.period_key || ' (' || r.fieldwork_label || ')'
        else t.period_key
    end as period_label
from typed as t
left join {{ ref('ess_rounds') }} as r
    on t.period_type = 'survey_round' and r.essround = try_cast(substr(t.period_key, 4) as integer)
