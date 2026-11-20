-- Projected residents per Region Stockholm planning area and year, 2025–2035 (2025 observed),
-- for the planning areas the planned stations are linked to (seeds.dooh_planning_areas).
select
    p.planning_area_code,
    p.planning_area,
    p.municipality_code,
    cast(p.year as integer) as year,
    cast(p.residents as double) as residents
from {{ source('rs_prognos', 'residents') }} as p
where p.planning_area_code in (
    select split_part(planning_area, ' ', 1) from {{ ref('dooh_planning_areas') }}
)
