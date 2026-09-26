-- fact_budget_frame as delivered, one row per object, every column typed explicitly, with its
-- position in the file: the legacy build broke ties by file order, and the reconciliation
-- holds the dbt build to the same result.
select
    cast(json ->> '$.actor' as VARCHAR) as actor,
    cast(json ->> '$.amount_msek' as BIGINT) as amount_msek,
    cast(json ->> '$.budget_share_pct' as DOUBLE) as budget_share_pct,
    cast(json ->> '$.budget_year' as BIGINT) as budget_year,
    cast(json ->> '$.deviation_msek' as BIGINT) as deviation_msek,
    cast(json ->> '$.document_id' as VARCHAR) as document_id,
    cast(json ->> '$.expenditure_area' as BIGINT) as expenditure_area,
    cast(json ->> '$.expenditure_area_name' as VARCHAR) as expenditure_area_name,
    cast(json ->> '$.government_amount_msek' as BIGINT) as government_amount_msek,
    cast(json ->> '$.proposal_type' as VARCHAR) as proposal_type,
    cast(json ->> '$.session' as VARCHAR) as session,
    cast(json ->> '$.source_url' as VARCHAR) as source_url,
    row_number() over () as file_order
from {{ source('politics_delivery', 'fact_budget_frame') }}
