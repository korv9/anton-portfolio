-- One row per passage of the statute-book corpus with its length in characters, for the
-- statute-book page's length bands. No text.
select
    id,
    dok_id,
    kind,
    length(text) as text_chars
from {{ ref('int_sfs_corpus_paragraphs') }}
