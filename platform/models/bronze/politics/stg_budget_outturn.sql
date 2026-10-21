-- Statskontoret's outturn per budget year and expenditure area as delivered, typed, in file order.
with outturn as (
    select json -> '$.data[*]' as rows from {{ source('politics_delivery', 'budget_outturn') }}
)
select
    cast(rows[i] ->> '$.budget_year' as BIGINT) as budget_year,
    cast(rows[i] ->> '$.expenditure_area' as BIGINT) as expenditure_area,
    cast(rows[i] ->> '$.expenditure_area_name' as VARCHAR) as expenditure_area_name,
    cast(rows[i] ->> '$.approved_budget_msek' as DOUBLE) as approved_budget_msek,
    cast(rows[i] ->> '$.amendments_msek' as DOUBLE) as amendments_msek,
    cast(rows[i] ->> '$.outturn_msek' as DOUBLE) as outturn_msek,
    cast(rows[i] ->> '$.appropriation_rows' as BIGINT) as appropriation_rows,
    cast(rows[i] ->> '$.source_url' as VARCHAR) as source_url,
    i as file_order
from outturn, range(1, len(rows) + 1) as t(i)
