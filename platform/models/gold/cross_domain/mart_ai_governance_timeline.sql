-- Month × series: AI in the Riksdag and in job ads, side by side with the AI Act's milestones,
-- for one aligned timeline. Each series keeps its own numerator and denominator and a
-- three-month rolling share (sums over the window); series are never added together or put on
-- one scale. Placing them on one time axis shows temporal overlap only: it does not show that
-- the Act, the debate or the job market caused one another.
with politics as (
    select 'riksdag_ai' as series_id, month::date as month, ai_speeches as numerator, speeches as denominator
    from {{ ref('mart_ai_politics_monthly') }}
    union all
    select 'riksdag_ai_act', month::date, ai_act_speeches, speeches
    from {{ ref('mart_ai_politics_monthly') }}
),

jobs as (
    select
        'jobs_' || term_id as series_id,
        month::date as month,
        mention_count as numerator,
        ads as denominator
    from {{ ref('mart_job_ai_governance_terms') }}
    where field_id = 'ALL' and term_id in ('ai_any', 'ai_act', 'ai_governance')
),

series as (
    select * from politics
    union all
    select * from jobs
)

select
    s.series_id,
    m.domain,
    s.month,
    s.numerator,
    s.denominator,
    s.numerator / nullif(s.denominator, 0) as share,
    sum(s.numerator) over w / nullif(sum(s.denominator) over w, 0) as share_rolling_3m,
    m.source_model,
    'derived' as content_type
from series as s
join {{ ref('ai_governance_series') }} as m using (series_id)
window w as (partition by s.series_id order by s.month rows between 2 preceding and current row)
