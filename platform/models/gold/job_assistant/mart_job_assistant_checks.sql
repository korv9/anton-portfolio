-- Education and conditions stated by the detailed ads, each with its sentence.
select distinct c.ad_id, c.kind, c.label, c.quote, c.line
from {{ ref('int_job_assistant_checks') }} as c
join {{ ref('mart_job_assistant_matches') }} as m using (ad_id)
where m.detailed
