-- fact_speech_vote_candidate as delivered, one row per object, every column typed explicitly, with its
-- position in the file: the legacy build broke ties by file order, and the reconciliation
-- holds the dbt build to the same result.
select
    cast(json ->> '$.cosine_similarity' as DOUBLE) as cosine_similarity,
    cast(json ->> '$.decision_url' as VARCHAR) as decision_url,
    cast(json ->> '$.evidence_status' as VARCHAR) as evidence_status,
    cast(json ->> '$.party' as VARCHAR) as party,
    cast(json ->> '$.same_member' as BOOLEAN) as same_member,
    cast(json ->> '$.speaker_vote' as VARCHAR) as speaker_vote,
    cast(json ->> '$.speech_id' as VARCHAR) as speech_id,
    cast(json ->> '$.speech_url' as VARCHAR) as speech_url,
    cast(json ->> '$.vote_id' as VARCHAR) as vote_id,
    row_number() over () as file_order
from {{ source('politics_delivery', 'fact_speech_vote_candidate') }}
