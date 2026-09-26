-- fact_point_reservation as delivered, one row per object, every column typed explicitly, with its
-- position in the file: the legacy build broke ties by file order, and the reconciliation
-- holds the dbt build to the same result.
select
    cast(json ->> '$.heading' as VARCHAR) as heading,
    cast(json ->> '$.party' as VARCHAR) as party,
    cast(json ->> '$.point_id' as VARCHAR) as point_id,
    cast(json ->> '$.proposal_type' as VARCHAR) as proposal_type,
    cast(json ->> '$.reservation_id' as VARCHAR) as reservation_id,
    cast(json ->> '$.reservation_number' as BIGINT) as reservation_number,
    cast(json ->> '$.source_url' as VARCHAR) as source_url,
    cast(json ->> '$.vote_id' as VARCHAR) as vote_id,
    row_number() over () as file_order
from {{ source('politics_delivery', 'fact_point_reservation') }}
