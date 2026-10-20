-- The academic corpus of The Lost Futures: publication year × theme in Swedish-language
-- student-thesis abstracts. Kept apart from the Riksdag marts: another genre, other authors.
-- A record comes back in a later month when DiVA changes or deletes it; only its latest month
-- counts, and a null year there (deleted, or no Swedish abstract) leaves it out.
with latest as (
    select *, case when month = 'before-2000' then '0000-00' else month end as seq
    from {{ source('futures', 'theses') }}
    qualify seq = max(seq) over (partition by id)
),

cells as (
    select year::integer as year, theme,
           count(*) as abstracts, count(*) filter (where future) as future,
           sum(matches) as matches, sum(words) as words
    from latest
    where year is not null
    group by all
),

totals as (
    select year, abstracts, future as future_abstracts, words from cells where theme = '_all'
)

select
    t.year, c.term_id as theme,
    t.abstracts, t.future_abstracts, t.words,
    coalesce(x.abstracts, 0) as abstracts_using,
    coalesce(x.future, 0) as future_using,
    coalesce(x.matches, 0) as matches,
    t.future_abstracts / nullif(t.abstracts, 0) as future_share,
    coalesce(x.future, 0) / nullif(t.future_abstracts, 0) as future_share_using,
    coalesce(x.matches, 0) * 1000.0 / nullif(t.words, 0) as per_1000_words
from totals t
cross join (select term_id from {{ ref('future_terms') }} where family = 'theme') c
left join cells x on x.year = t.year and x.theme = c.term_id
