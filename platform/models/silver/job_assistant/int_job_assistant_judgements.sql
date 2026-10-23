-- One row per matched ad and skill the ad names: how strongly the ad asks for it and the
-- strongest CV evidence level for it (null when the CV does not name it).
with skills as (
    select ad_id, unnest(from_json(skills, '[{"skill": "VARCHAR", "strength": "VARCHAR", "cv_level": "VARCHAR", "ad_quotes": "JSON", "cv_quotes": "JSON"}]')) as s
    from {{ ref('stg_job_assistant_matches') }}
)
select
    ad_id,
    s.skill,
    s.strength,
    s.cv_level,
    s.ad_quotes,
    s.cv_quotes
from skills
