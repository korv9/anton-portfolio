-- Every occupation field in the mart is a taxonomy field: no label from the crosswalk survives.
select distinct m.field
from {{ ref('mart_sweden_job_language') }} as m
where m.field in (select label from {{ ref('occupation_field_crosswalk') }})
