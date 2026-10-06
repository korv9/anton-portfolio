-- Every distinct Cellar answer, newest first per query: `related` (documents pointing to the
-- act) and `origin` (the proposal the act adopts). Silver reads the latest of each; older answers
-- stay so the history of what Cellar listed is kept.
with files as (
    select
        'cellar/' || regexp_extract(replace(filename, '\', '/'), 'cellar/((related|origin)@[0-9a-f]+\.json)$', 1) as path,
        regexp_extract(replace(filename, '\', '/'), 'cellar/(related|origin)@', 1) as query,
        content
    from {{ source('eu_ai_act', 'related') }}
)

select
    files.path,
    files.query,
    f.sha256 as source_hash,
    f.url as source_url,
    f.first_fetched_at,
    f.last_fetched_at,
    files.content as answer_json,
    row_number() over (partition by files.query order by f.last_fetched_at desc, f.first_fetched_at desc) = 1 as is_latest
from files
left join {{ ref('stg_ai_act_fetches') }} as f
    on f.path = files.path
