-- Product × dimension: how many checks were measured and how they came out. Counts only; no
-- score is computed, and a dimension with nothing measured says so.
select
    product_id,
    dimension,
    count(*) as check_count,
    count(*) filter (where status in ('pass', 'warning', 'fail')) as measured_count,
    count(*) filter (where status = 'pass') as pass_count,
    count(*) filter (where status = 'warning') as warning_count,
    count(*) filter (where status = 'fail') as fail_count,
    count(*) filter (where status = 'not_measured') as not_measured_count,
    count(*) filter (where status = 'not_applicable') as not_applicable_count
from {{ ref('mart_quality_checks') }}
group by all
