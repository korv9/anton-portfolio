-- The actors of the AI Act under their official terms, with the definition of Article 3
-- verbatim. A provider of a general-purpose AI model has no definition of its own: it is a
-- provider under Article 3(3), and `definition_note` says so.
with actors as (
    select * from {{ ref('ai_act_actors') }}
),

definitions as (
    select * from {{ ref('int_ai_act_definitions') }}
),

articles as (
    select
        actor_id,
        count(*) as articles_mentioning,
        count(*) filter (where duty_sentences > 0) as articles_with_duty_sentences
    from {{ ref('int_ai_act_article_actors') }}
    group by actor_id
)

select
    a.actor_id,
    a.official_term,
    a.label_en,
    a.label_sv,
    a.actor_group,
    a.definition_point,
    d.term as defined_term,
    d.definition,
    case when d.term <> a.official_term
        then 'Covered by the definition of ‘' || d.term || '’ in Article 3(' || d.point || ')'
    end as definition_note,
    coalesce(s.articles_mentioning, 0) as articles_mentioning,
    coalesce(s.articles_with_duty_sentences, 0) as articles_with_duty_sentences,
    a.match_pattern,
    a.sort_order,
    'source' as content_type
from actors as a
left join definitions as d
    on d.point = cast(a.definition_point as varchar)
left join articles as s on s.actor_id = a.actor_id
