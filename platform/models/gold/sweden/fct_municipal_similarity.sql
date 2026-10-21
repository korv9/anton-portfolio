-- SWEDEN C's inputs per municipality for the clustering's reference year (2024): the twelve
-- indicator values it was fitted on, from the panel copy it hashed and Kolada's four extra key
-- figures, and, for the 280 analysed municipalities, the groups and first two principal
-- components. log_population is derived in the export.
{% set kolada = ['out_commuting_pct', 'in_commuting_pct', 'dependency_ratio', 'post_secondary_25_64_pct'] %}
with points as (
    select * from {{ ref('stg_similarity_points') }}
), kolada as (
    select
        municipality_code,
        {% for f in kolada %}
        max(value) filter (where feature = '{{ f }}') as {{ f }}{{ ',' if not loop.last }}
        {% endfor %}
    from {{ ref('stg_similarity_kolada') }}
    group by all
)
select
    p.municipality_code,
    p.year,
    p.municipality_name,
    p.county_name,
    p.population,
    p.open_unemployment_18_65_pct,
    p.employment_rate_20_64_pct,
    p.ill_health_days,
    p.median_earned_income_sek,
    p.social_assistance_pct,
    p.turnout_riksdag_pct,
    p.eligible_vocational_programme_pct,
    {% for f in kolada %}
    k.{{ f }},
    {% endfor %}
    pt.group_id,
    pt.finer_group,
    pt.skr_group,
    pt.pc1,
    pt.pc2
from {{ ref('stg_similarity_panel') }} as p
join (select distinct year from points) as r on r.year = p.year
left join kolada as k on k.municipality_code = p.municipality_code
left join points as pt on pt.municipality_code = p.municipality_code
