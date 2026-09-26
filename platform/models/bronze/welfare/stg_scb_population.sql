-- Population on 31 December by region and sex. The current publication year comes from a
-- separate table; where both tables hold a year, the historical table is kept.
-- That table (BefolkningCKM) is protected with SCB's cell key method: each cell carries a
-- small random perturbation, so its parts do not add up exactly. `is_perturbed` marks it.
with cells as (
    {{ pxweb_rows(source('scb', 'population_year')) }}
    union all
    {{ pxweb_rows(source('scb', 'population_year_current')) }}
), rows as (
    select
        {{ px_dim('Region') }} as region_code,
        {{ px_dim('Kon') }} as sex_code,
        cast({{ px_dim('Tid') }} as integer) as year,
        {{ px_value(1) }} as population,
        filename as source_file,
        filename like '%population_year_current%' as is_perturbed
    from cells
)
select *
from rows
qualify row_number() over (partition by region_code, sex_code, year order by is_perturbed) = 1
