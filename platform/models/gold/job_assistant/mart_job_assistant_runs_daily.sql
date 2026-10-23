-- The record of scheduled operation: hourly runs per UTC day, how many ended well, and the ads
-- they saw as new, changed and removed.
select
    cast(timezone('UTC', started) as date) as day,
    count(*)::integer as runs,
    count(*) filter (where outcome = 'ok')::integer as runs_ok,
    count(*) filter (where outcome <> 'ok')::integer as runs_failed,
    sum(ads_new)::integer as ads_new,
    sum(ads_changed)::integer as ads_changed,
    sum(ads_removed)::integer as ads_removed,
    max(finished) as last_finished
from {{ ref('stg_job_assistant_runs') }}
group by all
