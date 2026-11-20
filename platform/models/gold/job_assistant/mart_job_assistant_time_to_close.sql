-- How long a removed Data/IT ad stayed up: days_open = removal day - publication day (Stockholm
-- local dates), over the ads mart_job_assistant_ads keeps (removed in the last 30 days), first
-- copies only. outcome: before_deadline (removed before its application deadline, so probably
-- filled or withdrawn), to_deadline (removed at or after it; an expired ad), no_deadline (none
-- given), and all. Per occupation and for all occupations ('all'). The median is null under
-- {{ var('time_to_close_min_ads', 20) }} ads, where it would mostly be noise.
with removed as (
    select
        occupation,
        date_diff('day', published::date, removed_at::date) as days_open,
        case
            when application_deadline is null then 'no_deadline'
            when removed_at < application_deadline then 'before_deadline'
            else 'to_deadline'
        end as outcome
    from {{ ref('mart_job_assistant_ads') }}
    where removed_at is not null and published is not null and occupation is not null
      and duplicate_of is null and removed_at::date >= published::date
), grouped as (
    select
        coalesce(occupation, 'all') as occupation,
        coalesce(outcome, 'all') as outcome,
        count(*)::bigint as ads,
        median(days_open)::double as median_days_open
    from removed
    group by grouping sets ((occupation, outcome), (occupation), (outcome), ())
)
select
    occupation, outcome, ads,
    case when ads >= {{ var('time_to_close_min_ads', 20) }} then median_days_open end as median_days_open
from grouped
