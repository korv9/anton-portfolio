-- The years covered and the comparable period: the latest year may be partial (a quarterly
-- archive, or the daily stream up to yesterday), so every year is also counted over the same
-- months as the latest year has (year to date), to compare like with like. Only complete
-- months count: the current month, while it runs, is left out of the comparison.
-- A table, not a view: current_date is fixed when the build runs, so the marts and the
-- export all see the same period.
{{ config(materialized='table') }}

with bounds as (
    select least(max(month), date_trunc('month', current_date) - interval 1 month)::date
        as last_month
    from {{ ref('stg_market_ads') }}
)
select
    year(last_month) as latest_year,
    month(last_month) as last_month_of_latest_year
from bounds
