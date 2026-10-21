-- The Lost Futures: calendar year × party over all Riksdag speeches. Sessions straddle calendar
-- years, so a year sums its autumn and spring. `marker_matches` is null for a cell until every
-- session in it was counted with the column. Per-theme counts are in mart_sweden_future_themes.
select try_cast(year as integer) as year,
       -- KDS is KD (parliament_party); the Speaker's, the King's and the ålderspresident's
       -- roles and a missing party have no party: null.
       case when not regexp_matches(upper(party), 'TALMAN|PRESIDENT|KONUNG')
            then {{ parliament_party('party') }} end as party,
       sum(speeches) as speeches, sum(future) as future_speeches, sum(words) as words,
       case when count(marker_matches) = count(*) then sum(marker_matches) end as marker_matches
from {{ ref('stg_futures_totals') }}
where try_cast(year as integer) is not null
group by all
