-- Domain × year: how many SCB tables report each year, at which finest geography. A table
-- covers every year from its first to its last period; gaps inside a series are not visible
-- in the catalogue, so this is an upper bound. Kolada has no first year in its catalogue and
-- is left out.
with years as (
    select unnest(range(1900, extract(year from current_date)::integer + 1)) as year
)
select
    i.domain_id,
    y.year,
    i.geo_resolution,
    count(*) as tables
from {{ ref('mart_sweden_measurement_items') }} i
join years y on y.year between i.first_year and i.last_year
where i.catalogue = 'scb'
group by all
