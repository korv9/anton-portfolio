-- Concept emphasis among speeches about AI: per period and party (and 'all'), the number of AI
-- speeches and how many contain each concept in an AI paragraph. Periods: the year, and the
-- three phases around the Act (before the Commission's proposal in April 2021, negotiation until
-- publication in July 2024, after). `party` is 'ALL' for every speaker, including those without a
-- party. Shares rest on `ai_speeches`; a small denominator is a small denominator.
with ai as (
    select * from {{ ref('fact_ai_speech') }} where mentions_ai
),

phased as (
    select
        *,
        case
            when speech_date < date '2021-04-21' then 'before_proposal'
            when speech_date < date '2024-07-12' then 'negotiation'
            else 'after_publication'
        end as phase
    from ai
),

periods as (
    select speech_id, party, cast(speech_year as varchar) as period, 'year' as period_kind from phased
    union all select speech_id, party, phase, 'phase' from phased
    union all select speech_id, party, 'all', 'all' from phased
),

with_all as (
    select * from periods
    union all select speech_id, 'ALL', period, period_kind from periods
),

denominators as (
    select coalesce(party, 'NONE') as party, period, period_kind, count(distinct speech_id) as ai_speeches
    from with_all group by all
),

hits as (
    select coalesce(w.party, 'NONE') as party, w.period, w.period_kind, c.concept_id,
           count(distinct w.speech_id) as speeches_with_concept
    from with_all as w
    join {{ ref('int_ai_speech_concepts') }} as c on c.speech_id = w.speech_id
    group by all
)

select
    d.party,
    d.period,
    d.period_kind,
    k.concept_id,
    d.ai_speeches,
    coalesce(h.speeches_with_concept, 0) as speeches_with_concept,
    coalesce(h.speeches_with_concept, 0) / d.ai_speeches as share
from denominators as d
cross join (select concept_id from {{ ref('ai_politics_concepts') }} where kind = 'framing') as k
left join hits as h
    on h.party = d.party and h.period = d.period and h.period_kind = d.period_kind
   and h.concept_id = k.concept_id
where d.party <> 'NONE'
