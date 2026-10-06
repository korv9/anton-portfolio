-- Every public AI Act row links to an official EU source: EUR-Lex, the Publications Office or
-- the Commission's own sites. No secondary source.
with links as (
    select 'document:' || document_id as row_id, source_url from {{ ref('dim_ai_act_document') }}
    union all select 'guidance:' || guidance_id, source_url from {{ ref('dim_ai_act_guidance') }}
    union all select 'article:' || article_id, source_url from {{ ref('dim_ai_act_article') }}
    union all select 'obligation:' || obligation_id, source_url from {{ ref('mart_ai_act_obligations') }}
    union all select 'milestone:' || milestone_id, source_url from {{ ref('mart_ai_act_timeline') }}
    union all select 'change:' || change_id, source_url from {{ ref('mart_ai_act_changes') }}
)

select *
from links
where not regexp_matches(source_url,
    '^https://(eur-lex\.europa\.eu|publications\.europa\.eu|digital-strategy\.ec\.europa\.eu|ai-act-service-desk\.ec\.europa\.eu)/')
