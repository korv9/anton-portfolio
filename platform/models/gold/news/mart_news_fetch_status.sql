-- The latest fetch of each news source, and when it last succeeded.
select
    source,
    max(cast(fetched_at as timestamptz)) as last_fetch,
    max(cast(fetched_at as timestamptz)) filter (where error is null) as last_success,
    arg_max(status, cast(fetched_at as timestamptz)) as last_status,
    arg_max(error, cast(fetched_at as timestamptz)) as last_error,
    count(*) as fetches,
    count(*) filter (where error is not null) as failed_fetches
from {{ source('news', 'fetches') }}
group by source
