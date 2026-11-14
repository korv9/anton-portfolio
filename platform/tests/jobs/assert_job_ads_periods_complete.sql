-- A period is complete exactly when every one of its days is covered; a week has seven days;
-- every role family's months add up to its year.
select period_kind, period_start, role_family
from {{ ref('mart_job_ads_periods') }}
where complete <> (days_covered = days_in_period)
   or (period_kind = 'week' and (days_in_period <> 7 or isodow(period_start) <> 1))
union all
select y.period_kind, y.period_start, y.role_family
from {{ ref('mart_job_ads_periods') }} as y
join {{ ref('mart_job_ads_periods') }} as m
    on m.period_kind = 'month' and y.role_family = m.role_family
    and date_trunc('year', m.period_start) = y.period_start
where y.period_kind = 'year'
group by y.period_kind, y.period_start, y.role_family, y.ads
having sum(m.ads) <> y.ads
