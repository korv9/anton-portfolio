-- One row per county and year with a handful of indicators side by side, for the
-- descriptive question "do regional unemployment, sick leave and self-rated health move
-- together?". It shows co-variation between counties and over time, not cause and effect:
-- counties differ in age structure, industry and much else that these columns omit.
--   unemployment_rate_pct       AKU, 15-74, annual, with its margin of error
--   sick_pay_rate_days          FK sjukpenningtal 2.0, December value (rolling 12 months), from 2021
--   stress_cases_per_1000       FK started F43 cases in the year per 1,000 inhabitants
--   serious_mental_strain_pct   Kolada N01452 (Folkhälsomyndigheten), as Kolada dates it
--   population                  SCB, 31 December
with counties as (
    select region_code, region_name from {{ ref('dim_region') }} where region_level = 'county'
), aku as (
    select region_code, cast(period_key as integer) as year, rate_pct, rate_pct_moe
    from {{ ref('fct_labour_force') }}
    where labour_status = 'unemployed' and sex_key = 'T' and length(period_key) = 4
), sick_pay as (
    select region_code, cast(left(period_key, 4) as integer) as year, sick_pay_rate
    from {{ ref('fct_sick_pay_rate') }}
    where sex_key = 'T' and age_group_key = '15-69' and right(period_key, 2) = '12'
), stress as (
    select region_code, cast(left(period_key, 4) as integer) as year,
           sum(cases) as cases, count(cases) as months_reported
    from {{ ref('fct_sick_leave_cases') }}
    where diagnosis_code = 'F43' and sex_key = 'T'
    group by all
), population as (
    select region_code, cast(period_key as integer) as year, population
    from {{ ref('fct_population') }}
    where sex_key = 'T'
), strain as (
    select region_code, cast(period_key as integer) as year, value
    from {{ ref('fct_kolada') }}
    where indicator_key = 'kolada_N01452' and sex_key = 'T'
), years as (
    select distinct year from aku
)
select
    c.region_code,
    c.region_name,
    y.year,
    a.rate_pct as unemployment_rate_pct,
    a.rate_pct_moe as unemployment_rate_moe,
    s.sick_pay_rate as sick_pay_rate_days,
    -- Only full years: a year still in progress would understate the rate.
    case when st.months_reported = 12 then round(st.cases * 1000 / p.population, 2) end
        as stress_cases_per_1000,
    m.value as serious_mental_strain_pct,
    p.population
from counties as c
cross join years as y
left join aku as a on a.region_code = c.region_code and a.year = y.year
left join sick_pay as s on s.region_code = c.region_code and s.year = y.year
left join stress as st on st.region_code = c.region_code and st.year = y.year
left join population as p on p.region_code = c.region_code and p.year = y.year
left join strain as m on m.region_code = c.region_code and m.year = y.year
