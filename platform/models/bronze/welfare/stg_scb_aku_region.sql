-- AKU by county, annual and quarterly. One row per region, status, sex and period.
-- Measure order is the same in both tables: level, its margin, percent, its margin.
with cells as (
    {{ pxweb_rows(source('scb', 'aku_region_year')) }}
    union all
    {{ pxweb_rows(source('scb', 'aku_region_quarter')) }}
)
select
    {{ px_dim('Region') }} as region_code,
    {{ px_dim('Arbetskraftstillh') }} as labour_status_code,
    {{ px_dim('Kon') }} as sex_code,
    {{ px_dim('Tid') }} as period_code,
    {{ px_value(1) }} as persons_thousands,
    {{ px_value(2) }} as persons_thousands_moe,
    {{ px_value(3) }} as rate_pct,
    {{ px_value(4) }} as rate_pct_moe,
    {{ px_marker(3) }} as rate_marker,
    filename as source_file
from cells
