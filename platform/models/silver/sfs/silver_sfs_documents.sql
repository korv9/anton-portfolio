-- One row per document in Riksdagen's SFS list, repealed ones included, with what the text's
-- header says and how the paragraph split went (silver_sfs_corpus_paragraphs).
--   kind          lag, förordning or other, from the first word of the title: "...lag" and
--                 "...balk" are laws, and so are the grundlagar and Riksdagsordningen whose
--                 names do not say so; "...förordning" is an ordinance.
--   parse_status  parsed; unnumbered when the body (header and transitional provisions left
--                 out) has no block starting "<n> §" other than "<n> § har upphävts"; failed
--                 when it has one but no paragraph came out; no text when the fetch failed.
with catalogue as (
    select
        *,
        trim(regexp_replace(titel, '\s+', ' ', 'g')) as title,
        lower(regexp_extract(regexp_replace(titel, '^(\s*/[^/]*/\s*)+', ''), '^([^\s(,]+)', 1))
            as word
    from {{ source('sfs', 'catalogue') }}
),

texts as (
    select
        *,
        -- The header ends at "Källa:"; the body ends at the transitional provisions.
        left(text, strpos(text, 'Källa:')) as head,
        split_part(substr(text, strpos(text, 'Källa:') + 1), 'Övergångsbestämmelser', 1) as body
    from {{ ref('stg_sfs_texts') }}
),

paragraphs as (
    select dok_id, count(*) as paragraphs
    from {{ ref('silver_sfs_corpus_paragraphs') }}
    where kind = 'paragraph'
    group by dok_id
),

documents as (
    select
        c.dok_id,
        c.beteckning as sfs,
        c.title,
        case
            when c.word in ('tryckfrihetsförordning', 'regeringsform', 'riksdagsordning',
                            'successionsordning')
                or c.title ilike '%om beslutad ny regeringsform%' then 'lag'
            when c.word like '%lag' or c.word like '%balk' then 'lag'
            when c.word like '%förordning' then 'förordning'
            else 'other'
        end as kind,
        c.subtyp,
        nullif(trim(c.organ), '') as organ,
        try_cast(c.datum as date) as issued,
        try_cast(c.systemdatum as timestamp) as changed_at,
        try_cast(nullif(regexp_extract(t.head, '(?m)^Upphävd:\s*(\d{4}-\d{2}-\d{2})', 1), '')
            as date) as repealed_on,
        nullif(regexp_extract(t.head, '(?m)^Ändrad:.*?(\d{4}:\d+)', 1), '') as amended_to,
        t.dok_id is not null as has_text,
        length(t.text) as text_chars,
        t.source_hash as text_hash,
        t.fetched_at,
        coalesce(p.paragraphs, 0) as paragraphs,
        regexp_matches(regexp_replace(t.body, '§ [Hh]ar upphävts', '', 'g'),
                       '\n[ \t]*\r?\n[ \t]*(/[^/\n]*/[ \t]*)?\d+( [a-z])? §') as numbered
    from catalogue as c
    left join texts as t on t.dok_id = c.dok_id
    left join paragraphs as p on p.dok_id = c.dok_id
)

select
    * exclude (numbered),
    repealed_on <= cast(fetched_at as date) as is_repealed,
    case
        when not has_text then 'no text'
        when paragraphs > 0 then 'parsed'
        when numbered then 'failed'
        else 'unnumbered'
    end as parse_status
from documents
