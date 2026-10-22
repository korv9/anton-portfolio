-- demand_curves.py reads one field per occupation group: the mart must give each group a single
-- field across all months.
select occupation_group, count(distinct occupation_field) as fields
from {{ ref('mart_job_ad_occupation_month') }}
group by occupation_group
having count(distinct occupation_field) > 1
