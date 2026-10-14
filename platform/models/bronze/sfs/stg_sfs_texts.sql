-- One row per fetched law: its dok_id, the text as served and when and from where it was fetched.
with files as (
    select
        'texts/' || regexp_extract(replace(filename, '\', '/'), 'texts/(.+\.text)$', 1) as path,
        content as text
    from {{ source('sfs', 'texts') }}
),

fetches as (
    select
        path,
        any_value(url) as url,
        arg_max(sha256, fetched_at) as sha256,
        max(cast(fetched_at as timestamptz)) as fetched_at
    from {{ source('sfs', 'fetches') }}
    where method = 'GET'
    group by path
)

select
    regexp_extract(f.path, 'texts/(.+)\.text$', 1) as dok_id,
    f.path,
    x.url as source_url,
    x.sha256 as source_hash,
    x.fetched_at,
    f.text
from files as f
left join fetches as x
    on x.path = f.path
