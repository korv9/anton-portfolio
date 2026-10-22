-- mart_job_ad_occupation_month takes any_value of the field: each occupation group must have one
-- (harmonised) field per month, or that pick would be arbitrary.
select a.month, a.occupation_group, count(distinct coalesce(x.field, a.occupation_field)) as fields
from {{ ref('stg_job_ad_occupation_month') }} as a
left join {{ ref('occupation_field_crosswalk') }} as x on x.label = a.occupation_field
group by a.month, a.occupation_group
having count(distinct coalesce(x.field, a.occupation_field)) > 1
