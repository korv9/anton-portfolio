-- Kolada's key figures: what each measures, for which kind of unit, and its latest period.
with listed as (
    select unnest("values") as k from {{ source('catalogue', 'kolada_kpis') }}
)
select
    k.id as kpi_id,
    k.title,
    k.description,
    -- Kolada republishes; the description names the original producer ("Källa: SCB.").
    nullif(trim(regexp_extract(k.description, 'Källa:\s*([^.]+)', 1)), '') as institution,
    k.operating_area,
    k.municipality_type,
    k.perspective,
    -- The period Kolada schedules next; empty when the figure is no longer published.
    try_cast(left(k.publ_period, 4) as integer) as scheduled_period,
    k.is_divided_by_gender
from listed
