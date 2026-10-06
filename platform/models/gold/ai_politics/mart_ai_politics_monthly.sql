-- Month by month: all speeches, speeches about AI and speeches naming the AI Act, with shares and
-- a three-month rolling share (sums over the window, not an average of shares).
with monthly as (
    select
        speech_month as month,
        count(*) as speeches,
        count(*) filter (where mentions_ai) as ai_speeches,
        count(*) filter (where names_ai_act) as ai_act_speeches
    from {{ ref('fact_ai_speech') }}
    group by speech_month
)

select
    month,
    speeches,
    ai_speeches,
    ai_act_speeches,
    ai_speeches / speeches as ai_share,
    sum(ai_speeches) over w / sum(speeches) over w as ai_share_rolling_3m,
    sum(speeches) over w as speeches_rolling_3m
from monthly
window w as (order by month rows between 2 preceding and current row)
order by month
