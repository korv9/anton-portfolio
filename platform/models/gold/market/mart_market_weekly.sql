-- New ads and vacancies per ISO week (Monday start), per occupation field and for the whole market
-- (field_id 'all'), summed from mart_market_daily. A field has no row on a day without ads, so a
-- week's coverage is the days the stream read whole ('all' rows): complete only with all seven.
-- An incomplete week (the first, the current) is marked and must not be compared. Preliminary.
with days as (
    select date_trunc('week', day)::date as week_start, count(*) as days_covered
    from {{ ref('mart_market_daily') }}
    where field_id = 'all'
    group by 1
)
select
    w.week_start,
    strftime(w.week_start, '%G-W%V') as iso_week,
    d.field_id,
    any_value(d.field) as field,
    sum(d.ads)::bigint as ads,
    sum(d.vacancies)::bigint as vacancies,
    w.days_covered::bigint as days_covered,
    w.days_covered = 7 as complete
from {{ ref('mart_market_daily') }} as d
join days as w on w.week_start = date_trunc('week', d.day)::date
group by w.week_start, d.field_id, w.days_covered
