-- European Social Survey, country x round, key items side by side (weighted means with
-- pspwght, respondents), plus pooled Nordic and EU-27 rows computed from respondents with
-- the analysis weight (pspwght x pweight), as ESS's weighting guide prescribes for pooling.
-- Group composition varies by round: countries_in_unit says which took part.
{% set items = ['ppltrst', 'trstprl', 'trstplt', 'trstplc', 'trstlgl', 'stflife', 'happy',
                'stfdem', 'stfeco', 'health', 'sclmeet', 'imwbcnt'] %}
with answers as (
    select a.*, c.is_nordic, c.is_eu27
    from {{ ref('int_welfare_ess_answers') }} as a
    join {{ ref('dim_country') }} as c using (country_code)
), units as (
    select 'country' as unit_type, country_code as unit_code, * from answers
    union all
    select 'group', 'NORDIC', * from answers where is_nordic
    union all
    select 'group', 'EU27', * from answers where is_eu27
)
select
    unit_type,
    unit_code,
    period_key,
    any_value(survey_mode) filter (where unit_type = 'country') as survey_mode,
    string_agg(distinct country_code, ',' order by country_code) as countries_in_unit,
    count(distinct respondent_id || country_code) as respondents,
    {% for item in items %}
    round(sum(case when variable = '{{ item }}' then answer * (case when unit_type = 'country' then weight else pooled_weight end) end)
        / nullif(sum(case when variable = '{{ item }}' then (case when unit_type = 'country' then weight else pooled_weight end) end), 0), 6)
        as {{ item }}_mean{{ ',' if not loop.last }}
    {% endfor %}
from units
group by unit_type, unit_code, period_key
