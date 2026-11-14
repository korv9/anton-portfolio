-- A median is published only over at least time_to_close_min_ads removed ads, and always then.
select occupation, outcome, ads, median_days_open
from {{ ref('mart_job_assistant_time_to_close') }}
where (ads < {{ var('time_to_close_min_ads', 20) }}) = (median_days_open is not null)
