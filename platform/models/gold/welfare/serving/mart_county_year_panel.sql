-- County x year panel (plus the country as region 00) for statistical analysis: one row per
-- region and calendar year, each column aggregated by its indicator's rule in dim_indicator.
--   rates:  SCB's published annual figure, or recomputed from additive components
--   flows:  summed over the year, only when all twelve months are published
--   stocks: December for population; the mean of months for ongoing sick-leave cases
--   rolling twelve-month rates: December
-- Survey indicators pooled over four years (Folkhälsomyndigheten) sit in the row of the
-- span's last year, with the span named in fohm_period. Numerators and denominators
-- (unemployed and labour force, sick-pay days and insured) ride along so that regions can be
-- combined correctly. Descriptive: correlations between
-- counties describe counties, not people (ecological fallacy).
{% set kolada = {
    'N03937': 'open_unemployment_18_65_pct', 'N02267': 'employment_rate_20_64_pct',
    'N00938': 'sick_pay_rate_1_days', 'N00957': 'ill_health_days',
    'N00906': 'median_earned_income_sek', 'N31807': 'social_assistance_pct',
    'N07403': 'violent_crime_per_100k', 'N05403': 'turnout_riksdag_pct',
    'N01452': 'serious_mental_strain_pct', 'U01473': 'good_wellbeing_pct',
    'U01413': 'low_trust_pct', 'N15428': 'eligible_vocational_programme_pct',
} %}
{% set fohm = {
    'fohm_psy_21': 'fohm_serious_mental_strain_pct', 'fohm_psy_01': 'fohm_good_wellbeing_pct',
    'fohm_allm_01': 'fohm_good_health_pct', 'fohm_soc_40': 'fohm_hard_to_trust_pct',
} %}
with regions as (
    select region_code, region_name, county_code, nuts2_code
    from {{ ref('dim_region') }}
    where region_level in ('country', 'county')
), population as (
    select region_code, cast(period_key as integer) as year, population, is_perturbed
    from {{ ref('fct_population') }}
    where sex_key = 'T'
), aku as (
    select region_code, cast(period_key as integer) as year,
        max(rate_pct) filter (where labour_status = 'unemployed') as unemployment_rate_pct,
        max(rate_pct_moe) filter (where labour_status = 'unemployed') as unemployment_rate_moe,
        max(rate_pct) filter (where labour_status = 'employed') as employment_rate_pct,
        max(persons_thousands) filter (where labour_status = 'unemployed') as unemployed_thousands,
        max(persons_thousands) filter (where labour_status = 'employed')
            + max(persons_thousands) filter (where labour_status = 'unemployed') as labour_force_thousands
    from {{ ref('fct_labour_force') }}
    where sex_key = 'T' and age_group_key = '15-74' and series_type = 'unadjusted'
      and regexp_full_match(period_key, '\d{4}')
    group by all
), sick_pay as (
    select region_code, cast(left(period_key, 4) as integer) as year,
           sick_pay_rate as sick_pay_rate_days, sick_pay_days, insured_persons
    from {{ ref('fct_sick_pay_rate') }}
    where sex_key = 'T' and age_group_key = '15-69' and right(period_key, 2) = '12'
), stress as (
    select region_code, cast(left(period_key, 4) as integer) as year,
           case when count(cases) = 12 then sum(cases) end as stress_cases_started
    from {{ ref('fct_sick_leave_cases') }}
    where case_type = 'started' and diagnosis_code = 'F43' and sex_key = 'T'
    group by all
), ongoing as (
    select region_code, cast(left(period_key, 4) as integer) as year,
           case when count(cases) = 12 then avg(cases) end as ongoing_sick_leave_mean
    from {{ ref('fct_sick_leave_cases') }}
    where case_type = 'ongoing' and diagnosis_code = 'ALL' and sex_key = 'T' and age_group_key = '16+'
    group by all
), kolada as (
    select region_code, cast(period_key as integer) as year,
        {% for kpi, column in kolada.items() %}
        max(value) filter (where indicator_key = 'kolada_{{ kpi }}') as {{ column }}{{ ',' if not loop.last }}
        {% endfor %}
    from {{ ref('fct_kolada') }}
    where sex_key = 'T'
    group by all
), fohm as (
    select f.region_code, p.reference_year as year, any_value(f.period_key) as fohm_period,
        {% for key, column in fohm.items() %}
        max(f.share_pct) filter (where f.indicator_key = '{{ key }}') as {{ column }}{{ ',' if not loop.last }}
        {% endfor %}
    from {{ ref('fct_health_survey') }} as f
    join {{ ref('dim_period') }} as p using (period_key)
    where f.sex_key = 'T' and f.age_group_key = '16-84' and p.period_type = 'pooled_years'
    group by all
 ), years as (
    -- Years with a published AKU annual figure, the panel's backbone.
    select distinct year from aku
)
select
    r.region_code,
    r.region_name,
    r.region_code = '00' as is_country,
    r.nuts2_code,
    y.year,
    make_date(y.year, 1, 1) as year_start,
    p.population,
    p.is_perturbed as population_is_perturbed,
    a.unemployment_rate_pct,
    a.unemployment_rate_moe,
    a.employment_rate_pct,
    a.unemployed_thousands,
    a.labour_force_thousands,
    s.sick_pay_rate_days,
    s.sick_pay_days,
    s.insured_persons,
    st.stress_cases_started,
    round(1000 * st.stress_cases_started / p.population, 4) as stress_cases_per_1000,
    o.ongoing_sick_leave_mean,
    round(1000 * o.ongoing_sick_leave_mean / p.population, 4) as ongoing_sick_leave_per_1000,
    {% for column in kolada.values() %}
    k.{{ column }},
    {% endfor %}
    h.fohm_period,
    {% for column in fohm.values() %}
    h.{{ column }}{{ ',' if not loop.last }}
    {% endfor %}
from regions as r
cross join years as y
left join population as p on p.region_code = r.region_code and p.year = y.year
left join aku as a on a.region_code = r.region_code and a.year = y.year
left join sick_pay as s on s.region_code = r.region_code and s.year = y.year
left join stress as st on st.region_code = r.region_code and st.year = y.year
left join ongoing as o on o.region_code = r.region_code and o.year = y.year
left join kolada as k on k.region_code = r.region_code and k.year = y.year
left join fohm as h on h.region_code = r.region_code and h.year = y.year
