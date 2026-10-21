-- The academic corpus of The Lost Futures: publication year over Swedish-language student-thesis
-- abstracts (int_sweden_future_theses_latest). Per-theme counts are in mart_sweden_future_theses.
select
    year::integer as year,
    count(*) as abstracts,
    count(*) filter (where future) as future_abstracts,
    sum(words) as words,
    count(*) filter (where future) / nullif(count(*), 0) as future_share
from {{ ref('int_sweden_future_theses_latest') }}
where theme = '_all' and year is not null
group by all
