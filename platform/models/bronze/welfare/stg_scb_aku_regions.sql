-- AKU's region list, which adds aggregates (0050, the country outside the three
-- metropolitan municipalities) to SCB's standard region codes.
with variables as (
    select unnest(variables) as variable
    from {{ source('scb', 'aku_region_metadata') }}
)
select
    unnest(variable."values") as region_code,
    unnest(variable.valueTexts) as region_name
from variables
where variable.code = 'Region'
