-- The public ad list: every current ad and those removed in the last 30 days, without the text.
-- expired: the application deadline, a Stockholm local timestamp (JobTech gives 23:59:59), has passed.
-- rank.py applies the same rule before matching.
select
    ad_id, headline, employer, organisation_number, municipality, region, occupation,
    employment_type, working_hours, published, changed, first_seen, application_deadline,
    removed_at, duplicate_of, source_url, application_url, content_hash,
    coalesce(application_deadline < cast(timezone('Europe/Stockholm', now()) as timestamp), false) as expired
from {{ ref('stg_job_assistant_ads') }}
where removed_at is null
   or removed_at >= cast(timezone('Europe/Stockholm', now()) as timestamp) - interval 30 days
