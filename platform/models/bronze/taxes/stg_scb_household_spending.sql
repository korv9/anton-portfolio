-- SCB's household budget survey (HUT): what a household spends in a year on each group of
-- goods and services, per household type, in kronor.
with cells as (
    select unnest(from_json(json -> '$.data', '[{"key": ["varchar"], "values": ["varchar"]}]')) as cell
    from {{ source('scb_household_spending', 'hut') }}
)
select
    cell.key[1] as household_type,
    cell.key[2] as spending_group,
    cast(cell.key[3] as integer) as year,
    try_cast(cell.values[1] as double) as sek_per_household
from cells
