-- The RFC drift report's version profiles as delivered, in file order; counts and shares_pct
-- stay JSON objects (keys vary by requirement keyword).
with report as (
    select json -> '$.versions[*]' as rows from {{ source('politics_delivery', 'rfc_drift') }}
)
select
    cast(rows[i] ->> '$.rfc' as BIGINT) as rfc,
    cast(rows[i] ->> '$.url' as VARCHAR) as url,
    cast(rows[i] ->> '$.sha256' as VARCHAR) as sha256,
    cast(rows[i] ->> '$.requirements' as BIGINT) as requirements,
    rows[i] -> '$.counts' as counts,
    rows[i] -> '$.shares_pct' as shares_pct,
    i as file_order
from report, range(1, len(rows) + 1) as t(i)
