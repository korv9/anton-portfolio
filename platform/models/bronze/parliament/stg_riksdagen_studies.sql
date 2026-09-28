-- Government studies: Statens offentliga utredningar (SOU), Departementsserien (Ds) and
-- Riksrevisionen's audit reports (RiR), one row per report. A report published in several
-- parts is kept as its main document, or its first part when there is no main one. The
-- listing's title is sometimes only the series and number ("sou 2026 56"); the notice text
-- then carries the real title and the inquiry that wrote it.
with pages as (
    select json -> '$.dokumentlista.dokument' as documents
    from {{ source('riksdagen', 'studies') }}
), documents as (
    select unnest(case when json_type(documents) = 'ARRAY'
                       then from_json(documents, '["json"]') else [documents] end) as doc
    from pages
    where documents is not null
), parsed as (
    select
        lower(doc ->> 'doktyp') as kind,
        doc ->> 'rm' as year_text,
        doc ->> 'beteckning' as number_text,
        doc ->> 'dok_id' as document_id,
        trim(doc ->> 'titel') as listed_title,
        regexp_replace(coalesce(doc ->> 'summary', ''), '\s+', ' ', 'g') as notice,
        try_cast(left(doc ->> 'datum', 10) as date) as published,
        nullif(doc ->> 'tempbeteckning', '') as part
    from documents
)
select
    kind || ':' || year_text || ':' || number_text as study_key,
    kind,
    cast(year_text as integer) as year,
    cast(number_text as integer) as number,
    case kind when 'rir' then 'RiR' when 'ds' then 'Ds' else upper(kind) end
        || ' ' || year_text || ':' || number_text as designation,
    document_id,
    case
        when regexp_matches(listed_title, '^(sou|ds) \d{4} \d+\s*$', 'i')
            then nullif(trim(regexp_extract(notice,
                '^(?:sou|ds) \d{4} \d+\s+(.*?)(?:\s+(?:Slut|Del)?[bB]etänkande av|\s+Promemoria|$)', 1, 'i')), '')
        else listed_title
    end as title,
    nullif(trim(regexp_extract(notice, '(?:Slut|Del)?[bB]etänkande av (.*?)(?:\s+Stockholm|\s+SOU|$)', 1)), '')
        as inquiry,
    published,
    'https://data.riksdagen.se/dokument/' || document_id as source_url
from parsed
where number_text ~ '^\d+$'
qualify row_number() over (partition by kind, year_text, number_text
                           order by part nulls first, published) = 1
