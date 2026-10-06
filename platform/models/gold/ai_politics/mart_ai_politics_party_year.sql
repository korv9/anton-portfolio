-- Party × calendar year: how many of the party's speeches mention AI, and the share.
select
    party,
    speech_year as year,
    count(*) as speeches,
    count(*) filter (where mentions_ai) as ai_speeches,
    count(*) filter (where mentions_ai) / count(*) as ai_share,
    count(*) filter (where names_ai_act) as ai_act_speeches
from {{ ref('fact_ai_speech') }}
where party is not null
group by party, speech_year
