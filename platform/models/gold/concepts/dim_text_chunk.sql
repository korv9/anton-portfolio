-- Every chunk the concept layer read, with full provenance. The text is the source's own
-- (cleaned of layout only); the sampling is derived.
select
    chunk_id,
    corpus_id,
    language,
    document_id,
    document_title,
    location,
    source_url,
    source_version,
    retrieved_at,
    period,
    word_count,
    text,
    'source' as content_type
from {{ source('concept_features', 'chunks') }}
