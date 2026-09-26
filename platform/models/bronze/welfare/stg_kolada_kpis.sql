select
    kpi.id as kpi_id,
    kpi.title as kpi_title,
    kpi.description as kpi_description,
    kpi.is_divided_by_gender,
    kpi.municipality_type,
    kpi.operating_area,
    kpi.publ_period
from (select unnest("values") as kpi from {{ source('kolada', 'kpis') }})
