-- The latest fetch of each news source, and when it last succeeded. A fetch log in which every
-- fetch succeeded has no error key at all, so the error is read from each line as JSON
-- (null when absent) rather than as a column.
with fetches as (
    select
        source,
        cast(fetched_at as timestamptz) as fetched_at,
        status,
        to_json(f) ->> 'error' as error
    from {{ source('news', 'fetches') }} as f
)
select
    source,
    max(fetched_at) as last_fetch,
    max(fetched_at) filter (where error is null) as last_success,
    arg_max(status, fetched_at) as last_status,
    arg_max(error, fetched_at) as last_error,
    count(*) as fetches,
    count(*) filter (where error is not null) as failed_fetches
from fetches
group by source
