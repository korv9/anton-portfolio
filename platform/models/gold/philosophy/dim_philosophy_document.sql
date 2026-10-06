-- The Philosophy Atlas's works: author, approximate year, period, tradition, area, original and
-- text language, translator (null with a note when the file names none), source and fetch hash.
select
    d.document_id,
    d.title,
    d.author,
    d.year,
    d.period,
    d.tradition,
    d.area,
    d.original_language,
    d.text_language,
    d.translator,
    d.translator_note,
    d.genre,
    d.gutenberg_id,
    d.source_url,
    d.source_hash,
    d.fetched_at,
    p.passages,
    p.words
from {{ ref('stg_philosophy_documents') }} as d
left join (
    select document_id, count(*) as passages, sum(word_count) as words
    from {{ ref('int_philosophy_passages') }} group by 1
) as p using (document_id)
