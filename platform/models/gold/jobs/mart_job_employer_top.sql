-- The 20 employers that posted the most IT ads (classified roles; Other left out) in two periods:
-- the latest twelve months whose archive import completed, and the latest calendar year with ads.
-- complete is false when a month of the period was not imported in full.
-- Only employers with an organisation number of a legal entity: digits only, the last ten, whose
-- month part (third and fourth digit) is 20 or more. A personal identity or coordination number
-- (a sole trader) has a month of 01-12 and is left out, as is anything else below 20. The number
-- itself is not selected. employer_id (a hash of it) keys each row for the tests and is never
-- exported. The count is of who posted the ad, a staffing or consultancy firm included, not of
-- who hires. Ties at the same count are ordered by name.
with months as (
    select publication_month, status = 'complete' as complete
    from {{ ref('stg_collection_coverage') }}
), periods as (
    select 'latest_12_months' as period_kind, (max(publication_month) - interval 11 month)::date as period_start,
        (max(publication_month) + interval 1 month)::date as period_end
    from months where complete
    union all
    select 'year', date_trunc('year', max(published_at))::date,
        (date_trunc('year', max(published_at)) + interval 1 year)::date
    from {{ ref('fct_job_ads') }} where role_family <> 'Other'
), covered as (
    select p.period_kind, p.period_start, p.period_end,
        count(*) filter (where m.complete) = date_diff('month', p.period_start, p.period_end) as complete
    from periods as p
    left join months as m on m.publication_month >= p.period_start and m.publication_month < p.period_end
    where p.period_start is not null
    group by p.period_kind, p.period_start, p.period_end
), legal_entities as (
    select employer_id, employer_name
    from {{ ref('dim_employer') }}
    where employer_name <> 'Unknown'
      and length(regexp_replace(organization_number, '[^0-9]', '', 'g')) in (10, 12)
      and try_cast(substr(right(regexp_replace(organization_number, '[^0-9]', '', 'g'), 10), 3, 2) as integer) >= 20
), counts as (
    select c.period_kind, c.period_start, c.period_end, c.complete, e.employer_id, e.employer_name,
        count(*)::bigint as ads
    from covered as c
    join {{ ref('fct_job_ads') }} as f
        on f.published_at >= c.period_start and f.published_at < c.period_end and f.role_family <> 'Other'
    join legal_entities as e using (employer_id)
    group by all
)
select period_kind, period_start, period_end, complete,
    row_number() over (partition by period_kind order by ads desc, employer_name, employer_id)::bigint
        as employer_rank,
    employer_id, employer_name, ads
from counts
qualify employer_rank <= 20
