-- Concept × concept relations, each with an explicit type:
-- semantic_similarity: the anchor sentences are close in both languages (each concept's three
--   nearest, kept only when the English and Swedish similarities agree on it);
-- shared_tension: the two concepts are the poles (or nearest concepts to the poles) of a
--   Philosophy Atlas tension (seeds/concepts/concept_tensions.csv), an editorial link.
with pairs as (
    select concept_a, concept_b, similarity_en, similarity_sv from {{ source('concept_features', 'concept_similarity') }}
    union all
    select concept_b, concept_a, similarity_en, similarity_sv from {{ source('concept_features', 'concept_similarity') }}
),

ranked as (
    select
        *,
        row_number() over (partition by concept_a order by similarity_en desc) as rank_en,
        row_number() over (partition by concept_a order by similarity_sv desc) as rank_sv
    from pairs
),

semantic as (
    select
        least(concept_a, concept_b) as concept_a,
        greatest(concept_a, concept_b) as concept_b,
        'semantic_similarity' as relation_type,
        max((similarity_en + similarity_sv) / 2) as strength,
        null as tension_id,
        'derived' as content_type
    from ranked
    where rank_en <= 3 and rank_sv <= 3
    group by all
),

tension as (
    select
        least(concept_a, concept_b) as concept_a,
        greatest(concept_a, concept_b) as concept_b,
        'shared_tension' as relation_type,
        null::double as strength,
        tension_id,
        'interpretation' as content_type
    from {{ ref('concept_tensions') }}
)

select * from semantic
union all
select * from tension
