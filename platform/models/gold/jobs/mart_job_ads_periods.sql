-- New IT ads per calendar period (ISO week from Monday, month, year) and role family, with 'all'
-- for every classified role (Other is left out, as in mart_job_trends_monthly), counted by
-- publication day from fct_job_ads. A day is covered when its month's archive import completed
-- (stg_collection_coverage); a period is complete only when every one of its days is covered and
-- inside the analysis range, so a week across a missing month or the range's edge is not.
-- An incomplete period is marked, never compared.
with days as (
    select d::date as day, date_trunc('month', d)::date as publication_month
    from generate_series(
        '{{ var("analysis_start", "2024-01-01") }}'::date,
        '{{ var("analysis_end", "2025-12-01") }}'::date + interval 1 month - interval 1 day,
        interval 1 day
    ) as t(d)
), covered as (
    select days.day, coalesce(c.status = 'complete', false) as covered
    from days
    left join {{ ref('stg_collection_coverage') }} as c using (publication_month)
), roles as (
    select role_family from {{ ref('role_patterns') }}
    union all
    select 'all'
), counts as (
    select published_at::date as day, coalesce(role_family, 'all') as role_family, count(*) as ads
    from {{ ref('fct_job_ads') }}
    where role_family <> 'Other' and published_at is not null
    group by grouping sets ((published_at::date, role_family), (published_at::date))
), daily as (
    select c.day, c.covered, r.role_family, coalesce(n.ads, 0) as ads
    from covered as c
    cross join roles as r
    left join counts as n on n.day = c.day and n.role_family = r.role_family
)
{% for kind in ['week', 'month', 'year'] %}
select
    '{{ kind }}' as period_kind, period_start, role_family,
    sum(ads)::bigint as ads,
    count(*) filter (where covered)::bigint as days_covered,
    date_diff('day', period_start, (period_start + interval 1 {{ kind }})::date)::bigint as days_in_period,
    count(*) filter (where covered) = date_diff('day', period_start, (period_start + interval 1 {{ kind }})::date)
        as complete
from (select date_trunc('{{ kind }}', day)::date as period_start, * from daily)
group by period_start, role_family
{% if not loop.last %}union all{% endif %}
{% endfor %}
