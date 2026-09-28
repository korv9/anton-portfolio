-- Ads and vacancies per occupation group and year, in full and over the same months as the
-- latest year (ads_ytd), with the change on the year before over those months.
with periods as (select * from {{ ref('int_market_periods') }}),
yearly as (
    select
        year(a.month) as year,
        a.group_id,
        sum(a.ads) as ads,
        sum(a.vacancies) as vacancies,
        sum(a.ads) filter (where month(a.month) <= p.last_month_of_latest_year) as ads_ytd,
        count(distinct a.month) as months
    from {{ ref('stg_market_ads') }} as a, periods as p
    where a.group_id is not null
    group by all
)
select
    y.year,
    y.group_id,
    g.ssyk,
    g.occupation_group,
    g.field_id,
    g.field,
    y.ads::bigint as ads,
    y.vacancies::bigint as vacancies,
    coalesce(y.ads_ytd, 0)::bigint as ads_ytd,
    y.months,
    lag(coalesce(y.ads_ytd, 0)) over (partition by y.group_id order by y.year) as ads_ytd_previous_year
from yearly as y
join {{ ref('dim_market_occupation_group') }} as g using (group_id)
