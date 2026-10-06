-- Every stored version of each Commission guidance page, with the page's entry in the list.
with files as (
    select
        regexp_extract(replace(filename, '\', '/'), 'guidance/(.+)@[0-9a-f]+\.html$', 1) as guidance_id,
        'guidance/' || regexp_extract(replace(filename, '\', '/'), 'guidance/(.+\.html)$', 1) as path,
        content as html
    from {{ source('eu_ai_act', 'guidance_pages') }}
)

select
    files.guidance_id,
    s.kind,
    s.url as source_url,
    to_json(s.articles) as articles_json,
    files.path,
    f.sha256 as source_hash,
    f.first_fetched_at,
    f.last_fetched_at,
    files.html
from files
join {{ source('eu_ai_act', 'guidance_sources') }} as s
    on s.id = files.guidance_id
left join {{ ref('stg_ai_act_fetches') }} as f
    on f.path = files.path
