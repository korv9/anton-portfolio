-- Sweden by month, for time-series work: labour market (seasonally adjusted and unadjusted),
-- sick-pay rate with its components, started cases with rolling twelve-month sums (a flow
-- summed over time), the psychiatric share of started cases (a ratio of two flows, formed
-- after summing), and ongoing cases (a stock: never summed over months).
with months as (
    select period_key, start_date as month_start
    from {{ ref('dim_period') }}
    where period_type = 'month'
), aku as (
    select period_key,
        max(rate_pct) filter (where labour_status = 'unemployed' and series_type = 'seasonally_adjusted') as unemployment_rate_sa,
        max(rate_pct) filter (where labour_status = 'employed' and series_type = 'seasonally_adjusted') as employment_rate_sa,
        max(rate_pct) filter (where labour_status = 'unemployed' and series_type = 'unadjusted') as unemployment_rate,
        max(rate_pct) filter (where labour_status = 'unemployed' and series_type = 'trend') as unemployment_rate_trend,
        max(persons_thousands) filter (where labour_status = 'unemployed' and series_type = 'unadjusted') as unemployed_thousands,
        max(persons_thousands) filter (where labour_status = 'labour_force' and series_type = 'unadjusted') as labour_force_thousands
    from {{ ref('fct_labour_force') }}
    where region_code = '00' and sex_key = 'T' and age_group_key = '15-74'
    group by period_key
), sick_pay as (
    select period_key, sick_pay_rate as sick_pay_rate_days, sick_pay_days, insured_persons
    from {{ ref('fct_sick_pay_rate') }}
    where region_code = '00' and sex_key = 'T' and age_group_key = '15-69'
), cases as (
    select period_key,
        max(cases) filter (where case_type = 'started' and diagnosis_code = 'ALL') as started_cases,
        max(cases) filter (where case_type = 'started' and diagnosis_code = 'F00-F99') as started_psychiatric,
        max(cases) filter (where case_type = 'started' and diagnosis_code = 'F43') as started_stress,
        max(cases) filter (where case_type = 'ongoing' and diagnosis_code = 'ALL' and age_group_key = '16+') as ongoing_cases
    from {{ ref('fct_sick_leave_cases') }}
    where region_code = '00' and sex_key = 'T'
    group by period_key
), joined as (
    select m.month_start, m.period_key, a.* exclude (period_key), s.* exclude (period_key),
           c.* exclude (period_key)
    from months as m
    left join aku as a using (period_key)
    left join sick_pay as s using (period_key)
    left join cases as c using (period_key)
)
select
    *,
    -- Rolling sums only over twelve consecutive published months.
    case when count(started_cases) over w12 = 12 then sum(started_cases) over w12 end as started_cases_12m,
    case when count(started_psychiatric) over w12 = 12 then sum(started_psychiatric) over w12 end as started_psychiatric_12m,
    case when count(started_psychiatric) over w12 = 12 and count(started_cases) over w12 = 12
         then round(100.0 * sum(started_psychiatric) over w12 / sum(started_cases) over w12, 2) end
        as psychiatric_share_of_started_12m_pct
from joined
where coalesce(unemployment_rate, sick_pay_rate_days, started_cases, ongoing_cases) is not null
window w12 as (order by month_start rows between 11 preceding and current row)
