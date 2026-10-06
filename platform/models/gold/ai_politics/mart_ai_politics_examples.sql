-- Example paragraphs for reading the counts against the words: per concept, the six most recent
-- AI paragraphs containing it, and every paragraph that names the AI Act. Newest first; examples,
-- not a representative sample. Each links to the speech on data.riksdagen.se.
with paragraphs as (
    select
        p.speech_id,
        p.paragraph,
        p.text,
        p.names_ai_act,
        p.concepts,
        f.speech_date,
        f.party,
        f.speaker,
        f.debate_title,
        f.source_url
    from {{ ref('int_ai_speech_paragraphs') }} as p
    join {{ ref('fact_ai_speech') }} as f on f.speech_id = p.speech_id
),

by_concept as (
    select
        k.concept_id,
        p.*,
        row_number() over (partition by k.concept_id order by p.speech_date desc, p.speech_id, p.paragraph) as rank
    from paragraphs as p
    join (select concept_id from {{ ref('ai_politics_concepts') }} where kind = 'framing') as k
        on json_extract(p.concepts, '$."' || k.concept_id || '"') is not null
)

select concept_id, speech_id, paragraph, text, speech_date, party, speaker, debate_title, source_url
from by_concept where rank <= 6
union all
select 'ai_act', speech_id, paragraph, text, speech_date, party, speaker, debate_title, source_url
from paragraphs where names_ai_act
