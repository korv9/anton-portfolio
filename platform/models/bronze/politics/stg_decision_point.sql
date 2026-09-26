-- fact_decision_point as delivered, one row per object, every column typed explicitly, with its
-- position in the file: the legacy build broke ties by file order, and the reconciliation
-- holds the dbt build to the same result.
select
    cast(json ->> '$.committee' as VARCHAR) as committee,
    cast(json ->> '$.decision_date' as DATE) as decision_date,
    cast(json ->> '$.decision_type' as VARCHAR) as decision_type,
    cast(json ->> '$.designation' as VARCHAR) as designation,
    cast(json ->> '$.document_id' as VARCHAR) as document_id,
    cast(json ->> '$.motion_count' as BIGINT) as motion_count,
    cast(json ->> '$.point' as BIGINT) as point,
    cast(json ->> '$.point_heading' as VARCHAR) as point_heading,
    cast(json ->> '$.point_id' as VARCHAR) as point_id,
    cast(json ->> '$.proposition_count' as BIGINT) as proposition_count,
    cast(json ->> '$.reservation_count' as BIGINT) as reservation_count,
    cast(json ->> '$.session' as VARCHAR) as session,
    cast(json ->> '$.source_url' as VARCHAR) as source_url,
    cast(json ->> '$.title' as VARCHAR) as title,
    cast(json ->> '$.vote_id' as VARCHAR) as vote_id,
    row_number() over () as file_order
from {{ source('politics_delivery', 'fact_decision_point') }}
