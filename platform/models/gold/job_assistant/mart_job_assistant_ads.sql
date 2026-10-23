-- The public ad list: every current ad and those removed in the last 30 days, without the text.
-- expired: the application deadline (Stockholm time, end of day for a date) has passed.
select
    ad_id, headline, employer, organisation_number, municipality, region, occupation,
    employment_type, working_hours, published, changed, first_seen, application_deadline,
    removed_at, duplicate_of, source_url, application_url, content_hash,
    coalesce(application_deadline < cast(timezone('Europe/Stockholm', now()) as timestamp), false) as expired
from {{ ref('stg_job_assistant_ads') }}
where removed_at is null
   or removed_at >= cast(timezone('Europe/Stockholm', now()) as timestamp) - interval 30 days
