-- The budget-language audit's coverage rows as delivered, typed, in file order.
with audit as (
    select json -> '$.coverage[*]' as rows from {{ source('politics_delivery', 'budget_language') }}
)
select
    cast(rows[i] ->> '$.corpus' as VARCHAR) as corpus,
    cast(rows[i] ->> '$.method' as VARCHAR) as method,
    cast(rows[i] ->> '$.session' as VARCHAR) as session,
    cast(rows[i] ->> '$.party' as VARCHAR) as party,
    cast(rows[i] ->> '$.speeches' as BIGINT) as speeches,
    cast(rows[i] ->> '$.words' as BIGINT) as words,
    cast(rows[i] ->> '$.matched_speeches' as BIGINT) as matched_speeches,
    cast(rows[i] ->> '$.hits' as BIGINT) as hits,
    cast(rows[i] ->> '$.zero_areas' as BIGINT) as zero_areas,
    i as file_order
from audit, range(1, len(rows) + 1) as t(i)
