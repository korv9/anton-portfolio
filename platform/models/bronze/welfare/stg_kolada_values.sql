-- One row per KPI, municipality or region, year and sex.
with elements as (
    select unnest("values") as element
    from {{ source('kolada', 'kpi_values') }}
), by_sex as (
    select element.kpi as kpi_id, element.municipality as kolada_region_id,
           cast(element.period as integer) as year, unnest(element."values") as observation
    from elements
)
select
    kpi_id,
    kolada_region_id,
    year,
    observation.gender as sex_code,
    observation."value" as value,
    nullif(observation.status, '') as value_status,
    observation.isdeleted as is_deleted
from by_sex
