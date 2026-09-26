-- Every headline value from every welfare source on one grain:
--   indicator x region x period x sex x age group
-- This is the table to join across domains: filter dim_indicator by domain, dim_region
-- by level, dim_period by type. Values keep their source's unit (see dim_indicator), and
-- periods differ by source; compare like with like through dim_period.reference_year.
with aku as (
    select
        case
            when labour_status = 'unemployed' and series_type = 'unadjusted' then 'aku_unemployment_rate'
            when labour_status = 'employed' and series_type = 'unadjusted' then 'aku_employment_rate'
            when labour_status = 'labour_force' and series_type = 'unadjusted' then 'aku_labour_force_participation'
            when labour_status = 'unemployed' and series_type = 'seasonally_adjusted' then 'aku_unemployment_rate_sa'
            when labour_status = 'employed' and series_type = 'seasonally_adjusted' then 'aku_employment_rate_sa'
        end as indicator_key,
        region_code, period_key, sex_key, age_group_key,
        rate_pct as value,
        rate_pct - rate_pct_moe as ci_low,
        rate_pct + rate_pct_moe as ci_high,
        null::double as sample_size
    from {{ ref('fct_labour_force') }}
    where rate_pct is not null
), fk_cases as (
    select
        case
            when case_type = 'ongoing' and diagnosis_code = 'ALL' then 'fk_ongoing_sick_leave'
            when case_type = 'started' and diagnosis_code = 'ALL' then 'fk_started_sick_leave'
            when case_type = 'started' and diagnosis_code = 'F00-F99' then 'fk_started_sick_leave_psychiatric'
            when case_type = 'started' and diagnosis_code = 'F43' then 'fk_started_sick_leave_stress'
        end as indicator_key,
        region_code, period_key, sex_key, age_group_key, cases as value,
        null::double, null::double, null::double
    from {{ ref('fct_sick_leave_cases') }}
    where cases is not null
)
select * from aku where indicator_key is not null
union all
select 'scb_population', region_code, period_key, sex_key, 'ALL', population, null, null, null
from {{ ref('fct_population') }}
union all
select 'fk_sick_pay_rate', region_code, period_key, sex_key, age_group_key, sick_pay_rate, null, null, null
from {{ ref('fct_sick_pay_rate') }}
where sick_pay_rate is not null
union all
select * from fk_cases where indicator_key is not null
union all
select indicator_key, region_code, period_key, sex_key, age_group_key, share_pct, ci_low_pct, ci_high_pct, responses
from {{ ref('fct_health_survey') }}
where share_pct is not null
union all
select indicator_key, '00', period_key, sex_key, age_group_key, mean_value, ci_low, ci_high, respondents
from {{ ref('fct_social_survey_country') }}
where country_code = 'SE'
union all
select indicator_key, region_code, period_key, 'T', '15+', mean_value, ci_low, ci_high, respondents
from {{ ref('fct_social_survey_region') }}
union all
select indicator_key, region_code, period_key, sex_key, 'ALL', value, null, null, null
from {{ ref('fct_kolada') }}
where value is not null
