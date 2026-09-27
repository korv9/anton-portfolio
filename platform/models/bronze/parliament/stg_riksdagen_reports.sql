-- Committee reports (betänkanden): one row per report and session. A listing page holds
-- either a list of documents or, when there is only one, the document itself.
with pages as (
    select json -> '$.dokumentlista.dokument' as documents
    from {{ source('riksdagen', 'reports') }}
), documents as (
    select unnest(case when json_type(documents) = 'ARRAY'
                       then from_json(documents, '["json"]') else [documents] end) as doc
    from pages
    where documents is not null
)
select distinct on (session, designation)
    doc ->> 'rm' as session,
    doc ->> 'beteckning' as designation,
    doc ->> 'dok_id' as document_id,
    doc ->> 'organ' as committee_code,
    trim(doc ->> 'titel') as title,
    nullif(trim(doc ->> 'notisrubrik'), '') as headline,
    -- Some early records carry a placeholder date (1899-01-01); that is no date.
    case when try_cast(nullif(doc ->> 'beslutsdag', '') as date) >= date '1990-01-01'
         then try_cast(nullif(doc ->> 'beslutsdag', '') as date) end as decision_date,
    try_cast(left(doc ->> 'datum', 10) as date) as document_date,
    'https://data.riksdagen.se/dokument/' || (doc ->> 'dok_id') as source_url
from documents
order by session, designation, document_date desc
