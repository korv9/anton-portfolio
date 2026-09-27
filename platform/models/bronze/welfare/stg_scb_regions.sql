-- SCB's region list: country (00), counties (two digits) and municipalities (four digits).
with variables as (
    select unnest(variables) as variable
    from {{ source('scb', 'population_region_metadata') }}
)
select
    unnest(variable."values") as region_code,
    unnest(variable.valueTexts) as region_name
from variables
where variable.code = 'Region'
