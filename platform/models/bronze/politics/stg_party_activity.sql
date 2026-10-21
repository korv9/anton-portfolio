-- The parliament activity summary as delivered, typed, in file order.
with summary as (
    select json -> '$.data[*]' as rows from {{ source('politics_delivery', 'party_activity') }}
)
select
    cast(rows[i] ->> '$.session' as VARCHAR) as session,
    cast(rows[i] ->> '$.party' as VARCHAR) as party,
    cast(rows[i] ->> '$.debate_speeches' as BIGINT) as debate_speeches,
    cast(rows[i] ->> '$.interpellations' as BIGINT) as interpellations,
    cast(rows[i] ->> '$.written_questions' as BIGINT) as written_questions,
    i as file_order
from summary, range(1, len(rows) + 1) as t(i)
