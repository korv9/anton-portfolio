-- Month × term × occupation field ('ALL' for the whole market): ads mentioning the term, all
-- ads, the share, a three-month rolling share (sums over the window) and the change in share
-- against the same month a year earlier, in percentage points. A mention is a dictionary match
-- in the ad's headline or description, not a confirmed requirement.
with totals as (
    select month, field_id, field, ads from {{ ref('stg_job_gov_totals') }}
    union all
    select month, 'ALL', 'All occupation fields', sum(ads) from {{ ref('stg_job_gov_totals') }} group by month
),

hits as (
    select month, field_id, term_id, ads from {{ ref('stg_job_gov_terms') }}
    union all
    select month, 'ALL', term_id, sum(ads) from {{ ref('stg_job_gov_terms') }} group by month, term_id
),

grid as (
    select t.month, t.field_id, t.field, t.ads, k.term_id
    from totals as t
    cross join (select term_id from {{ ref('job_ai_governance_terms') }}) as k
),

joined as (
    select
        g.month,
        g.field_id,
        g.field,
        g.term_id,
        coalesce(h.ads, 0) as mention_count,
        g.ads
    from grid as g
    left join hits as h on h.month = g.month and h.field_id = g.field_id and h.term_id = g.term_id
)

select
    *,
    mention_count / ads as share,
    sum(mention_count) over w / sum(ads) over w as share_rolling_3m,
    mention_count / ads - lag(mention_count / ads, 12) over (partition by field_id, term_id order by month)
        as share_change_yoy_pp
from joined
window w as (partition by field_id, term_id order by month rows between 2 preceding and current row)
