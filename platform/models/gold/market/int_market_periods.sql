-- The years covered and the comparable period: the latest year may be partial (a quarterly
-- archive), so every year is also counted over the same months as the latest year has
-- (year to date), to compare like with like.
with bounds as (
    select max(month) as last_month from {{ ref('stg_market_ads') }}
)
select
    year(last_month) as latest_year,
    month(last_month) as last_month_of_latest_year
from bounds
