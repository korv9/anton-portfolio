-- Every distinct Cellar answer on the documents related to the act, newest first. Silver reads
-- the latest; older answers stay so the history of what Cellar listed is kept.
with files as (
    select
        'cellar/' || regexp_extract(replace(filename, '\', '/'), 'cellar/(related@[0-9a-f]+\.json)$', 1) as path,
        content
    from {{ source('eu_ai_act', 'related') }}
)

select
    files.path,
    f.sha256 as source_hash,
    f.url as source_url,
    f.first_fetched_at,
    f.last_fetched_at,
    files.content as answer_json,
    row_number() over (order by f.last_fetched_at desc, f.first_fetched_at desc) = 1 as is_latest
from files
left join {{ ref('stg_ai_act_fetches') }} as f
    on f.path = files.path
