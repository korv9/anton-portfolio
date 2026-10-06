-- A check that measured nothing carries no value, and a passed check carries one: "not
-- measured" is never shown as confidence.
select quality_check_id, status, value
from {{ ref('mart_quality_checks') }}
where (status in ('not_measured', 'not_applicable') and value is not null)
   or (status in ('pass', 'warning', 'fail') and value is null)
