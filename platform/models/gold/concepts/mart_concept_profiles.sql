-- Concept × corpus: how often the concept is a chunk's closest concept (rank 1) or among its
-- three closest, against the chance share. A within-chunk comparison, so it does not depend on
-- how close a corpus's language is to anchor sentences in general. Derived.
with counts as (
    select
        corpus_id,
        concept_id,
        count(*) as chunks,
        count(*) filter (where rank = 1) as rank1_chunks,
        count(*) filter (where rank <= 3) as top3_chunks
    from {{ ref('fact_concept_alignment') }}
    group by all
),

n as (select count(*) as concepts from {{ ref('dim_concept') }})

select
    c.corpus_id,
    c.concept_id,
    c.chunks,
    c.rank1_chunks,
    c.top3_chunks,
    c.rank1_chunks / c.chunks as rank1_share,
    c.top3_chunks / c.chunks as top3_share,
    1.0 / n.concepts as rank1_chance,
    (c.rank1_chunks / c.chunks) * n.concepts as rank1_lift,
    'derived' as content_type
from counts as c cross join n
