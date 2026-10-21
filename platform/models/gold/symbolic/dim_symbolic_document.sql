-- One row per book of the Symbolic Atlas corpus: its metadata, cleaned word count and where the
-- text came from (Gutenberg id and source URL). No text.
select
    d.document_id,
    d.title,
    d.author,
    d.tradition,
    d.word_count,
    s.gutenberg_id,
    s.source_url,
    d.translator,
    d.culture,
    d.region,
    d.genre,
    d.source_type,
    d.period,
    d.pilot
from {{ ref('int_symbolic_documents') }} as d
join {{ ref('stg_symbolic_documents') }} as s using (document_id)
