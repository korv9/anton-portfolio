-- One row per book: the text exactly as fetched, its corpus metadata and the provenance of the
-- latest fetch. Nothing is cleaned here; silver removes Gutenberg's header and licence.
with latest_fetch as (
    select path, url, sha256, fetched_at
    from {{ source('symbolic', 'fetches') }}
    where method = 'GET'
    qualify row_number() over (partition by path order by fetched_at desc) = 1
)
select
    c.id as document_id,
    c.title,
    c.author,
    c.tradition,
    c.language,
    c.source,
    c.gutenberg_id,
    c.source_url,
    f.sha256 as source_hash,
    cast(f.fetched_at as timestamptz) as fetched_at,
    t.content as raw_text
from {{ source('symbolic', 'corpus') }} as c
join {{ source('symbolic', 'texts') }} as t
    on replace(t.filename, '\', '/') like '%/' || c.path
left join latest_fetch as f
    on f.path = c.path
