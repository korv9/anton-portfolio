-- The AI Act's dates in one place: when parts of it apply and the deadlines it sets (curated
-- from Articles 113, 111 and 6, each with its sentence), and the dates of the documents that
-- made it (from Cellar). `status_at_build` is relative to the day the warehouse was built; the
-- site recomputes it against the reader's date.
with curated as (
    select
        milestone_id,
        cast(date as date) as date,
        kind,
        title_en,
        title_sv,
        description_en,
        description_sv,
        affected_articles,
        affected_actors,
        source_article,
        source_quote,
        'https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:'
            || (select celex from {{ ref('int_ai_act_documents') }} where is_current)
            || '#art_' || source_article as source_url,
        'curated from the Act' as origin
    from {{ ref('ai_act_milestones') }}
),

documents as (
    select
        'document-' || lower(replace(replace(celex, '(', ''), ')', '')) as milestone_id,
        published_at as date,
        'document' as kind,
        case document_type
            when 'original_proposal' then 'The Commission proposes the AI Act'
            when 'regulation' then 'Published in the Official Journal'
            when 'amending_regulation' then 'Amending regulation adopted'
            when 'consolidated_version' then 'New consolidated text'
        end as title_en,
        case document_type
            when 'original_proposal' then 'Kommissionen föreslår AI-förordningen'
            when 'regulation' then 'Publicerad i Europeiska unionens officiella tidning'
            when 'amending_regulation' then 'Ändringsförordning antagen'
            when 'consolidated_version' then 'Ny konsoliderad text'
        end as title_sv,
        title as description_en,
        title as description_sv,
        null as affected_articles,
        null as affected_actors,
        null as source_article,
        null as source_quote,
        source_url,
        'Cellar' as origin
    from {{ ref('dim_ai_act_document') }}
    where document_type in ('original_proposal', 'regulation', 'amending_regulation')
       or (document_type = 'consolidated_version' and published_at > (
            select min(published_at) from {{ ref('dim_ai_act_document') }}
            where document_type = 'consolidated_version'))
)

select
    *,
    case when date <= current_date then 'applies' else 'upcoming' end as status_at_build,
    current_date as built_on
from (select * from curated union all select * from documents)
