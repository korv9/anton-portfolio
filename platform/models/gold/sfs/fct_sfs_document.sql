-- One row per document in Riksdagen's SFS list, with what the statute-book page counts:
-- kind, year of issue and repeal, whether the text was fetched, and its numbered paragraphs (§)
-- and passages. A § split into stycken counts once in sections and once per stycke in
-- paragraph_passages.
with passages as (
    select
        dok_id,
        count(distinct coalesce(chapter, '') || '|' || paragraph)
            filter (where kind = 'paragraph') as sections,
        count(*) filter (where kind = 'paragraph') as paragraph_passages,
        count(*) filter (where kind = 'whole_text') as whole_text_passages
    from {{ ref('silver_sfs_corpus_paragraphs') }}
    group by dok_id
)

select
    d.dok_id,
    d.sfs,
    d.title,
    d.kind,
    d.issued,
    year(d.issued) as issued_year,
    d.repealed_on,
    coalesce(d.is_repealed, false) as is_repealed,
    case when d.is_repealed then year(d.repealed_on) end as repealed_year,
    d.has_text,
    d.parse_status,
    d.text_chars,
    d.fetched_at,
    coalesce(p.sections, 0) as sections,
    coalesce(p.paragraph_passages, 0) as paragraph_passages,
    coalesce(p.whole_text_passages, 0) as whole_text_passages
from {{ ref('silver_sfs_documents') }} as d
left join passages as p on p.dok_id = d.dok_id
