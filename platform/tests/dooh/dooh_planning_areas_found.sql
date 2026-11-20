-- Every planning area a planned station is linked to has all eleven projection years, and every
-- new planned station has a link.
with linked as (
    select distinct split_part(planning_area, ' ', 1) as code from {{ ref('dooh_planning_areas') }}
)
select l.code as missing
from linked as l
left join {{ ref('fct_dooh_planning_area_year') }} as p on p.planning_area_code = l.code
group by l.code
having count(p.year) <> 11
union all
select s.station
from {{ ref('dooh_planned_stations') }} as s
where s.kind = 'new'
  and s.station not in (select station from {{ ref('dooh_planning_areas') }})
