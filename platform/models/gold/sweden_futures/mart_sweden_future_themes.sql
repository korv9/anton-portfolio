-- The Lost Futures: calendar year × party × theme in Riksdag speeches. Only the per-theme counts;
-- the speeches, words and marker matches of a year and party are in mart_sweden_future_totals,
-- once per cell. Every theme gets a row for every year and party, zero when unused.
with hits as (
    select try_cast(year as integer) as year,
           -- KDS is KD (parliament_party); the Speaker's, the King's and the ålderspresident's
           -- roles and a missing party have no party: null.
           case when not regexp_matches(upper(party), 'TALMAN|PRESIDENT|KONUNG')
                then {{ parliament_party('party') }} end as party, theme,
           sum(speeches) as speeches_using, sum(future) as future_using, sum(matches) as matches
    from {{ ref('stg_futures_hits') }}
    group by all
)

select
    t.year, t.party, c.term_id as theme,
    coalesce(h.speeches_using, 0) as speeches_using,
    coalesce(h.future_using, 0) as future_using,
    coalesce(h.matches, 0) as matches
from {{ ref('mart_sweden_future_totals') }} t
cross join (select term_id from {{ ref('future_terms') }} where family = 'theme') c
left join hits h on h.year = t.year and h.party is not distinct from t.party and h.theme = c.term_id
