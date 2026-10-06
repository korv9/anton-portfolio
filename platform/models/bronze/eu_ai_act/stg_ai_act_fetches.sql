-- One row per stored file: when it was first and last fetched, from where and with which hash.
-- A file is one published text (acts/), or one version of a page or query answer (@<sha12>).
select
    path,
    any_value(url) as url,
    any_value(sha256) as sha256,
    min(cast(fetched_at as timestamptz)) as first_fetched_at,
    max(cast(fetched_at as timestamptz)) as last_fetched_at,
    count(*) as fetch_count,
    any_value(logical_path) as logical_path
from {{ source('eu_ai_act', 'fetches') }}
where method = 'GET'
group by path
