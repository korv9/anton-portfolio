-- The books as natural language: Gutenberg's header and licence cut off at the START and END
-- markers, illustration placeholders removed, and white space (line breaks included) collapsed
-- to single spaces. Case, punctuation and every word are kept: the embeddings read sentences.
with body as (
    select
        *,
        coalesce(
            nullif(regexp_extract(
                raw_text,
                '(?s)\*\*\*\s*START OF (?:THE|THIS) PROJECT GUTENBERG E(?:BOOK|TEXT)[^*]*\*\*\*(.*?)\*\*\*\s*END OF (?:THE|THIS) PROJECT GUTENBERG',
                1), ''),
            raw_text) as body
    from {{ ref('stg_symbolic_documents') }}
), cleaned as (
    select
        *,
        trim(regexp_replace(
            regexp_replace(body, '\[Illustration[^\]]*\]', ' ', 'g'),
            '\s+', ' ', 'g')) as clean_text
    from body
)
select
    document_id,
    title,
    author,
    tradition,
    language,
    source_hash,
    clean_text,
    length(string_split(clean_text, ' ')) as word_count,
    length(raw_text) - length(clean_text) as characters_removed
from cleaned
