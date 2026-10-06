-- One row per act text as served by Cellar: CELEX number, language, the XHTML and its provenance.
with files as (
    select
        replace(filename, '\', '/') as filename,
        content
    from {{ source('eu_ai_act', 'texts') }}
),

named as (
    select
        regexp_extract(filename, 'acts/(.+)\.([a-z]{2})\.xhtml$', 1) as celex,
        regexp_extract(filename, 'acts/(.+)\.([a-z]{2})\.xhtml$', 2) as language,
        'acts/' || regexp_extract(filename, 'acts/(.+\.xhtml)$', 1) as path,
        content as xhtml
    from files
)

select
    n.celex,
    n.language,
    n.path,
    f.url as source_url,
    f.sha256 as source_hash,
    f.first_fetched_at as retrieved_at,
    f.last_fetched_at as last_checked_at,
    n.xhtml
from named as n
left join {{ ref('stg_ai_act_fetches') }} as f
    on f.path = n.path
