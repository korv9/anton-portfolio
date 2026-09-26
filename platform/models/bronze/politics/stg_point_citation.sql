-- fact_point_citation as delivered, one row per object, every column typed explicitly, with its
-- position in the file: the legacy build broke ties by file order, and the reconciliation
-- holds the dbt build to the same result.
select
    cast(json ->> '$.citation_id' as VARCHAR) as citation_id,
    cast(json ->> '$.claim_number' as BIGINT) as claim_number,
    cast(json ->> '$.claim_scope' as VARCHAR) as claim_scope,
    cast(json ->> '$.document_id' as VARCHAR) as document_id,
    cast(json ->> '$.document_reference' as VARCHAR) as document_reference,
    cast(json ->> '$.document_type' as VARCHAR) as document_type,
    cast(json ->> '$.document_url' as VARCHAR) as document_url,
    cast(json ->> '$.link_evidence' as VARCHAR) as link_evidence,
    cast(json ->> '$.point_id' as VARCHAR) as point_id,
    row_number() over () as file_order
from {{ source('politics_delivery', 'fact_point_citation') }}
