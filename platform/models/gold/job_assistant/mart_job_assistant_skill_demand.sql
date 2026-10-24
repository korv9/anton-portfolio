-- What the current Data/IT ads ask for against what the CV documents: per skill, how many matched
-- ads name it as required, preferred or in passing, and the CV's strongest evidence level for it.
with matched as (
    select count(*) as ads from {{ ref('stg_job_assistant_matches') }}
)
select
    j.skill,
    count(*) filter (where j.strength = 'required')::integer as ads_required,
    count(*) filter (where j.strength = 'preferred')::integer as ads_preferred,
    count(*)::integer as ads_naming,
    count(*) / max(matched.ads) as share_naming,
    any_value(j.cv_level) as cv_level
from {{ ref('int_job_assistant_judgements') }} as j
cross join matched
group by j.skill
