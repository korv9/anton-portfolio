-- Year × theme across all parties: which futures the chamber speaks of. Each rate is over
-- speeches of that year (mart_sweden_future_trends_total); nothing is pooled across corpora.
with themes as (
    select year, theme,
           sum(speeches_using) as speeches_using,
           sum(future_using) as future_using,
           sum(matches) as matches
    from {{ ref('mart_sweden_future_themes') }}
    group by year, theme
)

select
    t.year, t.theme, t.speeches_using, t.future_using, t.matches,
    t.future_using / nullif(y.future_speeches, 0) as future_share_using,
    t.matches * 1000.0 / nullif(y.words, 0) as per_1000_words
from themes as t
join {{ ref('mart_sweden_future_trends_total') }} as y using (year)
