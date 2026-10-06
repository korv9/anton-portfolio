-- New ads and vacancies per publication day, per occupation field and for the whole market
-- (field_id 'all'), from JobTech's stream. Only the days the stream has read whole: from its
-- first run to yesterday. Preliminary: the quarterly archive is the record once published.
select
    cast(d.publication_date as date) as day,
    d.field_id,
    coalesce(f.field, 'Hela arbetsmarknaden') as field,
    d.ads::bigint as ads,
    d.vacancies::bigint as vacancies
from {{ source('jobtech_market', 'daily') }} as d
left join {{ ref('dim_market_field') }} as f using (field_id)
where d.field_id = 'all' or f.field_id is not null
