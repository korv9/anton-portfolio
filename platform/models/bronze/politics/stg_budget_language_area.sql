-- The budget-language audit's area rows as delivered, every column typed explicitly, with
-- their position in the file: the gold table keeps that order.
with audit as (
    select json -> '$.rows[*]' as rows from {{ source('politics_delivery', 'budget_language') }}
)
select
    cast(rows[i] ->> '$.corpus' as VARCHAR) as corpus,
    cast(rows[i] ->> '$.method' as VARCHAR) as method,
    cast(rows[i] ->> '$.session' as VARCHAR) as session,
    cast(rows[i] ->> '$.party' as VARCHAR) as party,
    cast(rows[i] ->> '$.expenditure_area' as BIGINT) as expenditure_area,
    cast(rows[i] ->> '$.occurrences' as BIGINT) as occurrences,
    cast(rows[i] ->> '$.keyword_share_pct' as DOUBLE) as keyword_share_pct,
    rows[i] -> '$.forms' as forms,
    i as file_order
from audit, range(1, len(rows) + 1) as t(i)
