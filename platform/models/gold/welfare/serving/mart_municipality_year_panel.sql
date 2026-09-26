-- Municipality x year panel of the Kolada key figures, with population and county for
-- grouping. Kolada publishes county and national values itself: compare municipalities with
-- those rather than rolling municipalities up (see dim_indicator.space_rule). Small
-- municipalities' survey-based figures have wide intervals.
{% set kolada = {
    'N03937': 'open_unemployment_18_65_pct', 'N02267': 'employment_rate_20_64_pct',
    'N00938': 'sick_pay_rate_1_days', 'N00957': 'ill_health_days',
    'N00906': 'median_earned_income_sek', 'N31807': 'social_assistance_pct',
    'N05403': 'turnout_riksdag_pct', 'N01452': 'serious_mental_strain_pct',
    'U01473': 'good_wellbeing_pct', 'U01413': 'low_trust_pct',
    'N15428': 'eligible_vocational_programme_pct',
} %}
with kolada as (
    select region_code, cast(period_key as integer) as year,
        {% for kpi, column in kolada.items() %}
        max(value) filter (where indicator_key = 'kolada_{{ kpi }}') as {{ column }}{{ ',' if not loop.last }}
        {% endfor %}
    from {{ ref('fct_kolada') }}
    where sex_key = 'T'
    group by all
)
select
    r.region_code as municipality_code,
    r.region_name as municipality_name,
    r.county_code,
    r.county_name,
    r.nuts2_code,
    k.year,
    p.population,
    {% for column in kolada.values() %}
    k.{{ column }}{{ ',' if not loop.last }}
    {% endfor %}
from kolada as k
join {{ ref('dim_region') }} as r on r.region_code = k.region_code and r.region_level = 'municipality'
left join {{ ref('fct_population') }} as p
    on p.region_code = k.region_code and p.period_key = cast(k.year as varchar) and p.sex_key = 'T'
