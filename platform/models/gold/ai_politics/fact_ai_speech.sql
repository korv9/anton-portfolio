-- One row per Riksdag speech with whether it is about AI (any paragraph passes the AI gate) and
-- whether it names the AI Act. The denominator for every share in this subject.
with ai as (
    select
        speech_id,
        count(*) as ai_paragraphs,
        bool_or(names_ai_act) as names_ai_act
    from {{ ref('int_ai_speech_paragraphs') }}
    group by speech_id
)

select
    s.speech_id,
    s.session,
    s.speech_date,
    s.speech_month,
    s.speech_year,
    s.party,
    s.speaker,
    s.debate_title,
    s.debate_kind,
    s.word_count,
    coalesce(ai.ai_paragraphs, 0) as ai_paragraphs,
    ai.speech_id is not null as mentions_ai,
    coalesce(ai.names_ai_act, false) as names_ai_act,
    s.source_url
from {{ ref('int_riksdag_speeches') }} as s
left join ai on ai.speech_id = s.speech_id
