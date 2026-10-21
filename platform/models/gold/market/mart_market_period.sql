-- The latest year and its last complete month, for the export: int_market_periods in gold, so
-- the export reads only gold. One row.
select latest_year, last_month_of_latest_year
from {{ ref('int_market_periods') }}
