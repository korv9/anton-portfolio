-- Framing pairs (seeds/ai_politics/ai_politics_framing_pairs.csv), per party and phase: how many
-- AI speeches use concept A, concept B, both, and the balance (A − B) / (A + B), from −1 (only B)
-- to 1 (only A). The balance is left empty below ten speeches using either: too few to compare.
-- Descriptive only: which words a party's AI speeches use, not why.
with c as (
    select * from {{ ref('mart_ai_politics_concepts') }}
),

speech_pairs as (
    select
        p.pair_id,
        w.party,
        w.period,
        w.period_kind,
        count(distinct w.speech_id) filter (where a.speech_id is not null) as speeches_a,
        count(distinct w.speech_id) filter (where b.speech_id is not null) as speeches_b,
        count(distinct w.speech_id) filter (where a.speech_id is not null and b.speech_id is not null) as speeches_both
    from {{ ref('ai_politics_framing_pairs') }} as p
    cross join (
        select speech_id, coalesce(party, 'NONE') as party, 'all' as period, 'all' as period_kind
        from {{ ref('fact_ai_speech') }} where mentions_ai
        union all
        select speech_id, 'ALL', 'all', 'all' from {{ ref('fact_ai_speech') }} where mentions_ai
        union all
        select speech_id, coalesce(party, 'NONE'),
            case when speech_date < date '2021-04-21' then 'before_proposal'
                 when speech_date < date '2024-07-12' then 'negotiation' else 'after_publication' end,
            'phase'
        from {{ ref('fact_ai_speech') }} where mentions_ai
        union all
        select speech_id, 'ALL',
            case when speech_date < date '2021-04-21' then 'before_proposal'
                 when speech_date < date '2024-07-12' then 'negotiation' else 'after_publication' end,
            'phase'
        from {{ ref('fact_ai_speech') }} where mentions_ai
    ) as w
    left join {{ ref('int_ai_speech_concepts') }} as a on a.speech_id = w.speech_id and a.concept_id = p.concept_a
    left join {{ ref('int_ai_speech_concepts') }} as b on b.speech_id = w.speech_id and b.concept_id = p.concept_b
    group by all
)

select
    s.*,
    d.ai_speeches,
    case when s.speeches_a + s.speeches_b >= 10
        then (s.speeches_a - s.speeches_b) / (s.speeches_a + s.speeches_b) end as balance
from speech_pairs as s
join (select distinct party, period, ai_speeches from c) as d
    on d.party = s.party and d.period = s.period
where s.party <> 'NONE'
