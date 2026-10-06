-- The four corpora, their stage in the chain stories → ideas → contestation → codification,
-- and how many chunks of each the concept layer sampled.
select
    c.corpus_id,
    c.label_en,
    c.label_sv,
    c.stage,
    c.language,
    c.description_en,
    c.domain,
    count(k.chunk_id) as chunks,
    count(distinct k.document_id) as documents,
    min(k.retrieved_at) as first_retrieved_at,
    max(k.retrieved_at) as last_retrieved_at
from {{ ref('corpora') }} as c
left join {{ source('concept_features', 'chunks') }} as k using (corpus_id)
group by all
