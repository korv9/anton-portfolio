-- Speech × concept: a concept counts for a speech when it occurs in at least one of the speech's
-- AI paragraphs. `matches` is the number of occurrences; `terms` the words as written.
with exploded as (
    select
        p.speech_id,
        k.concept_id,
        cast(json_extract(p.concepts, '$."' || k.concept_id || '"') as varchar[]) as terms
    from {{ ref('int_ai_speech_paragraphs') }} as p
    cross join (select concept_id from {{ ref('ai_politics_concepts') }} where kind = 'framing') as k
)

select
    speech_id,
    concept_id,
    sum(len(terms)) as matches,
    list_distinct(flatten(list(terms))) as terms
from exploded
where terms is not null
group by speech_id, concept_id
