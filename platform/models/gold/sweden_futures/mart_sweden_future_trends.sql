-- Year × theme across all parties: how often the chamber speaks of the future, and which
-- futures. Each rate is over speeches of that year; nothing is pooled across corpora.
select
    year, theme,
    sum(speeches) as speeches,
    sum(future_speeches) as future_speeches,
    sum(words) as words,
    sum(speeches_using) as speeches_using,
    sum(future_using) as future_using,
    sum(matches) as matches,
    sum(future_speeches) / nullif(sum(speeches), 0) as future_share,
    sum(future_using) / nullif(sum(future_speeches), 0) as future_share_using,
    sum(matches) * 1000.0 / nullif(sum(words), 0) as per_1000_words
from {{ ref('mart_sweden_future_themes') }}
group by year, theme
