-- A whole-text passage belongs to a document with no paragraph and no XML text.
select w.dok_id
from {{ ref('silver_sfs_corpus_paragraphs') }} as w
join {{ ref('stg_sfs_texts') }} as t on t.dok_id = w.dok_id
where w.kind = 'whole_text'
    and (ltrim(t.text) like '<%'
        or w.dok_id in (
            select dok_id from {{ ref('silver_sfs_corpus_paragraphs') }} where kind = 'paragraph'
        ))
