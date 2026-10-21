-- The academic corpus of The Lost Futures: publication year × theme in Swedish-language
-- student-thesis abstracts. Kept apart from the Riksdag marts: another genre, other authors.
-- Each record counts once, at its latest harvested month (int_sweden_future_theses_latest). The
-- abstracts and words of a year are in mart_sweden_future_theses_total.
with cells as (
    select year::integer as year, theme,
           count(*) as abstracts, count(*) filter (where future) as future,
           sum(matches) as matches
    from {{ ref('int_sweden_future_theses_latest') }}
    where year is not null and theme <> '_all'
    group by all
)

select
    t.year, c.term_id as theme,
    coalesce(x.abstracts, 0) as abstracts_using,
    coalesce(x.future, 0) as future_using,
    coalesce(x.matches, 0) as matches,
    coalesce(x.future, 0) / nullif(t.future_abstracts, 0) as future_share_using,
    coalesce(x.matches, 0) * 1000.0 / nullif(t.words, 0) as per_1000_words
from {{ ref('mart_sweden_future_theses_total') }} as t
cross join (select term_id from {{ ref('future_terms') }} where family = 'theme') as c
left join cells as x on x.year = t.year and x.theme = c.term_id
