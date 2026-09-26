-- Model-ready features from the county panel: each measure with its value one and two years
-- earlier and its change on the year before, and the county's gap to the country in the same
-- year. Lags only look backwards, so a model predicting year t from these columns sees
-- nothing published for t. Rows are counties only; missing stays missing (no imputation).
{% set measures = ['unemployment_rate_pct', 'employment_rate_pct', 'sick_pay_rate_days',
                   'stress_cases_per_1000', 'ongoing_sick_leave_per_1000',
                   'open_unemployment_18_65_pct', 'social_assistance_pct', 'median_earned_income_sek',
                   'serious_mental_strain_pct', 'low_trust_pct'] %}
with panel as (
    select * from {{ ref('mart_county_year_panel') }}
), country as (
    select year, {% for m in measures %}{{ m }} as country_{{ m }}{{ ',' if not loop.last }}{% endfor %}
    from panel where is_country
)
select
    p.region_code,
    p.region_name,
    p.year,
    p.population,
    {% for m in measures %}
    p.{{ m }},
    lag(p.{{ m }}, 1) over w as {{ m }}_lag1,
    lag(p.{{ m }}, 2) over w as {{ m }}_lag2,
    round(p.{{ m }} - lag(p.{{ m }}, 1) over w, 4) as {{ m }}_change_1y,
    round(p.{{ m }} - c.country_{{ m }}, 4) as {{ m }}_gap_to_country{{ ',' if not loop.last }}
    {% endfor %}
from panel as p
left join country as c using (year)
where not p.is_country
-- lag() over consecutive rows equals the previous year because every county has a row for
-- every year in the panel (the panel cross-joins regions and years).
window w as (partition by p.region_code order by p.year)
