-- Year × sub-term of the security and culture themes (future_subterms) across all parties. Each
-- share is over the year's future-oriented speeches (mart_sweden_future_trends_total).
with hits as (
    select try_cast(year as integer) as year, theme as subterm,
           sum(speeches) as speeches_using, sum(future) as future_using, sum(matches) as matches
    from {{ ref('stg_futures_hits') }}
    group by all
)

select
    y.year, s.theme, s.term_id as subterm,
    coalesce(h.speeches_using, 0) as speeches_using,
    coalesce(h.future_using, 0) as future_using,
    coalesce(h.matches, 0) as matches,
    coalesce(h.future_using, 0) / nullif(y.future_speeches, 0) as future_share_using
from {{ ref('mart_sweden_future_trends_total') }} as y
cross join {{ ref('future_subterms') }} as s
left join hits as h on h.year = y.year and h.subterm = s.term_id
