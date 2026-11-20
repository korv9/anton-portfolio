-- A week is complete exactly when the stream read all seven of its days, and the whole-market row
-- sums the same days as mart_market_daily.
select w.week_start, w.days_covered, w.complete, w.ads, sum(d.ads) as daily_ads
from {{ ref('mart_market_weekly') }} as w
left join {{ ref('mart_market_daily') }} as d
    on d.field_id = 'all' and date_trunc('week', d.day)::date = w.week_start
where w.field_id = 'all'
group by all
having w.complete <> (w.days_covered = 7) or w.ads <> sum(d.ads)
    or count(d.day) <> w.days_covered
