-- One row per detailed ad and skill: how strongly the ad asks for it and the CV evidence level.
select j.ad_id, j.skill, j.strength, j.cv_level
from {{ ref('int_job_assistant_judgements') }} as j
join {{ ref('mart_job_assistant_matches') }} as m using (ad_id)
where m.detailed
