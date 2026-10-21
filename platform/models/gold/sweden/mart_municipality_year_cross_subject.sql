-- One row per municipality and year that any of the joined products covers: the welfare panel
-- (Kolada key figures and population, turnout included), the local income tax rate
-- (Skatteverket), party shares in the latest Riksdag election held by that year (SCB), public
-- libraries (SWEDEN D) and, for the clustering's reference year, SWEDEN C's frozen inputs and
-- groups (prefixed similarity_). Each product keeps its own years; a missing one is NULL.
{% set similarity = ['population', 'median_earned_income_sek', 'post_secondary_25_64_pct',
                     'group_id', 'finer_group', 'skr_group', 'pc1', 'pc2'] %}
{% set parties = ['S', 'M', 'SD', 'V', 'C', 'KD', 'MP', 'L'] %}
with panel as (
    select * from {{ ref('mart_municipality_year_panel') }}
), libraries as (
    select * from {{ ref('fct_library_municipality_year') }}
), similarity as (
    select * from {{ ref('fct_municipal_similarity') }}
), tax as (
    -- Every parish of a municipality has the same municipal and regional rate.
    select municipality_code, year, max(local_income_tax_rate) as local_income_tax_rate
    from {{ ref('fct_municipal_tax_rate') }}
    group by all
), elections as (
    select
        municipality_code, election_year,
        {% for p in parties %}
        max(share_pct) filter (where party = '{{ p }}') as share_{{ p | lower }}_pct{{ ',' if not loop.last }}
        {% endfor %}
    from {{ ref('fct_election_municipality') }}
    group by all
), spine as (
    select municipality_code, year from panel
    union
    select municipality_code, year from libraries
    union
    select municipality_code, year from similarity
    union
    select municipality_code, year from tax
)
select
    s.municipality_code,
    s.year,
    d.municipality_name,
    d.county_code,
    p.population,
    p.open_unemployment_18_65_pct,
    p.employment_rate_20_64_pct,
    p.sick_pay_rate_1_days,
    p.ill_health_days,
    p.median_earned_income_sek,
    p.social_assistance_pct,
    p.turnout_riksdag_pct,
    p.serious_mental_strain_pct,
    p.good_wellbeing_pct,
    p.low_trust_pct,
    p.eligible_vocational_programme_pct,
    t.local_income_tax_rate,
    e.election_year,
    {% for p in parties %}
    e.share_{{ p | lower }}_pct,
    {% endfor %}
    l.service_points as library_service_points,
    l.visits as library_visits,
    l.activities as library_activities,
    l.active_borrowers as library_active_borrowers,
    l.population as library_population,
    {% for c in similarity %}
    c.{{ c }} as similarity_{{ c }}{{ ',' if not loop.last }}
    {% endfor %}
from spine as s
left join {{ ref('dim_municipality') }} as d on d.municipality_code = s.municipality_code
left join panel as p on p.municipality_code = s.municipality_code and p.year = s.year
left join tax as t on t.municipality_code = s.municipality_code and t.year = s.year
asof left join elections as e on e.municipality_code = s.municipality_code and e.election_year <= s.year
left join libraries as l on l.municipality_code = s.municipality_code and l.year = s.year
left join similarity as c on c.municipality_code = s.municipality_code and c.year = s.year
