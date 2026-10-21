-- The Lost Futures: calendar year × party × theme in Riksdag speeches. `future_share_using` is
-- the share of future-oriented speeches that use the theme; `per_1000_words` counts matches in
-- all speeches. Sessions straddle calendar years, so a year sums its autumn and spring.
-- `marker_matches` is null for a cell until every session in it was counted with the column.
with totals as (
    select try_cast(year as integer) as year, coalesce(party, 'Unknown') as party,
           sum(speeches) as speeches, sum(future) as future_speeches, sum(words) as words,
           case when count(marker_matches) = count(*) then sum(marker_matches) end as marker_matches
    from {{ source('futures', 'totals') }}
    group by all
),

hits as (
    select try_cast(year as integer) as year, coalesce(party, 'Unknown') as party, theme,
           sum(speeches) as speeches_using, sum(future) as future_using, sum(matches) as matches
    from {{ source('futures', 'hits') }}
    group by all
)

select
    t.year, t.party, c.term_id as theme,
    t.speeches, t.future_speeches, t.words, t.marker_matches,
    coalesce(h.speeches_using, 0) as speeches_using,
    coalesce(h.future_using, 0) as future_using,
    coalesce(h.matches, 0) as matches
from totals t
cross join (select term_id from {{ ref('future_terms') }} where family = 'theme') c
left join hits h on h.year = t.year and h.party = t.party and h.theme = c.term_id
where t.year is not null
