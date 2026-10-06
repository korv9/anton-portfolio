-- Per concept and pair of corpora: the most similar pair of the two corpora's representative
-- chunks, with the random-pair baseline for those corpora. Semantic similarity of wording,
-- not influence or shared meaning.
select
    concept_id,
    corpus_a,
    corpus_b,
    chunk_a,
    chunk_b,
    similarity,
    baseline_mean,
    baseline_p95,
    above_baseline,
    'semantic_similarity' as relation_type,
    'derived' as content_type
from {{ source('concept_features', 'cross_pairs') }}
