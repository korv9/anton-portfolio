-- The representative chunks per concept and corpus (the concept is among the chunk's three
-- closest, ranked by z-score in the corpus), with text and provenance. What the model finds
-- closest to an anchor sentence, not a judgement that the passage is about the concept.
select
    a.concept_id,
    a.corpus_id,
    a.representative_rank,
    a.similarity,
    a.rank,
    a.z_score,
    k.chunk_id,
    k.language,
    k.document_id,
    k.document_title,
    k.location,
    k.source_url,
    k.source_version,
    k.retrieved_at,
    k.period,
    k.text,
    'derived' as content_type
from {{ ref('fact_concept_alignment') }} as a
join {{ ref('dim_text_chunk') }} as k using (chunk_id, corpus_id)
where a.representative_rank is not null
