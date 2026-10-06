-- Chunk × concept: cosine similarity to the concept's anchor in the chunk's language, the
-- concept's rank among all concepts for that chunk, and a z-score against the same concept in
-- the same corpus. Derived; raw similarities are not comparable across corpora.
select
    chunk_id,
    corpus_id,
    concept_id,
    similarity,
    rank::integer as rank,
    z_score,
    representative_rank::integer as representative_rank,
    'derived' as content_type
from {{ source('concept_features', 'alignment') }}
