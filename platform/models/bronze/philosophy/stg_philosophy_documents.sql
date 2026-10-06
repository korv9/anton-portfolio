-- One row per work: the text as fetched, its corpus metadata (author, year, tradition,
-- translator, where the author's own text starts and ends) and the provenance of the latest fetch.
with latest_fetch as (
    select path, url, sha256, fetched_at
    from {{ source('philosophy', 'fetches') }}
    where method = 'GET'
    qualify row_number() over (partition by path order by fetched_at desc) = 1
)

select
    c.id as document_id,
    c.title,
    c.author,
    c.year,
    c.period,
    c.tradition,
    c.area,
    c.original_language,
    'en' as text_language,
    c.translator,
    c.translator_note,
    c.genre,
    c.gutenberg_id,
    c.source_url,
    to_json(c.text_start) as text_start,
    to_json(c.text_end) as text_end,
    f.sha256 as source_hash,
    cast(f.fetched_at as timestamptz) as fetched_at,
    t.content as raw_text
from {{ source('philosophy', 'corpus') }} as c
join {{ source('philosophy', 'texts') }} as t
    on replace(t.filename, '\', '/') like '%/' || c.path
left join latest_fetch as f
    on f.path = c.path
