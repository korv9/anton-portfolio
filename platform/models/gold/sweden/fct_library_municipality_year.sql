-- Public libraries per municipality and year (KB's bibstat): staffed service points, physical
-- visits, public activities and active borrowers, with the municipal population as denominator.
-- A total is NULL when one of the municipality's reporting organisations omitted the term that
-- year (the sum would be partial), and zero visits with staffed service points, or zero service
-- points with visits, are NULL rather than zero; set_to_missing names each such value.
{% set measures = ['service_points', 'visits', 'activities', 'active_borrowers'] %}
with observations as (
    select * from {{ ref('fct_library_observation') }}
    where municipality_code is not null and value is not null
), organisations as (
    select municipality_code, year, count(distinct sigel) as organisations
    from observations group by all
), sums as (
    -- bibstat's four terms are counts.
    select municipality_code, year, measure, cast(sum(value) as bigint) as total,
           count(distinct sigel) as reporters
    from observations group by all
), complete as (
    select
        o.municipality_code, o.year,
        {% for m in measures %}
        max(s.total) filter (where s.measure = '{{ m }}' and s.reporters = o.organisations) as {{ m }},
        bool_or(s.measure = '{{ m }}' and s.reporters < o.organisations) as {{ m }}_partial{{ ',' if not loop.last }}
        {% endfor %}
    from organisations as o
    join sums as s using (municipality_code, year)
    group by all
), population as (
    select municipality_code, year, population
    from {{ ref('mart_municipality_year_panel') }}
    where population is not null
)
select
    c.municipality_code,
    c.year,
    case when c.service_points = 0 and c.visits <> 0 then null else c.service_points end as service_points,
    case when c.visits = 0 and c.service_points <> 0 then null else c.visits end as visits,
    c.activities,
    c.active_borrowers,
    -- The year's population, or the year before's while SCB has not published it.
    coalesce(p.population, p_before.population) as population,
    list_filter([
        {% for m in measures %}
        case when c.{{ m }}_partial then '{{ m }}: an organisation did not report' end,
        {% endfor %}
        case when c.visits = 0 and c.service_points <> 0 then 'visits: 0 with staffed service points' end,
        case when c.service_points = 0 and c.visits <> 0 then 'service_points: 0 with visits' end
    ], x -> x is not null) as set_to_missing
from complete as c
left join population as p on p.municipality_code = c.municipality_code and p.year = c.year
left join population as p_before on p_before.municipality_code = c.municipality_code and p_before.year = c.year - 1
