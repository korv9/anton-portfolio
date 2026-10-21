-- Year across all parties and themes: how often the chamber speaks of the future, over all
-- speeches of the year. The per-theme counts are in mart_sweden_future_trends.
select
    year,
    sum(speeches) as speeches,
    sum(future_speeches) as future_speeches,
    sum(words) as words,
    case when count(marker_matches) = count(*) then sum(marker_matches) end as marker_matches,
    sum(future_speeches) / nullif(sum(speeches), 0) as future_share,
    sum(words) / nullif(sum(speeches), 0) as words_per_speech,
    case when count(marker_matches) = count(*) then sum(marker_matches) * 1000.0 / nullif(sum(words), 0) end
        as marker_per_1000_words
from {{ ref('mart_sweden_future_totals') }}
group by year
