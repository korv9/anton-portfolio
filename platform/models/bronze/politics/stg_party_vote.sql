-- fact_party_vote as delivered, one row per object, every column typed explicitly, with its
-- position in the file: the legacy build broke ties by file order, and the reconciliation
-- holds the dbt build to the same result.
select
    cast(json ->> '$.absent_votes' as BIGINT) as absent_votes,
    cast(json ->> '$.abstain_votes' as BIGINT) as abstain_votes,
    cast(json ->> '$.cast_votes' as BIGINT) as cast_votes,
    cast(json ->> '$.no_votes' as BIGINT) as no_votes,
    cast(json ->> '$.party' as VARCHAR) as party,
    cast(json ->> '$.party_position' as VARCHAR) as party_position,
    cast(json ->> '$.point_id' as VARCHAR) as point_id,
    cast(json ->> '$.session' as VARCHAR) as session,
    cast(json ->> '$.vote_date' as DATE) as vote_date,
    cast(json ->> '$.vote_id' as VARCHAR) as vote_id,
    cast(json ->> '$.yes_votes' as BIGINT) as yes_votes,
    row_number() over () as file_order
from {{ source('politics_delivery', 'fact_party_vote') }}
