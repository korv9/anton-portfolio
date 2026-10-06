-- Article × Commission guidance page: which guidance concerns which article (our list,
-- platform/ingest/eu_ai_act/sources.py).
select distinct
    unnest(cast(json(g.articles_json) as varchar[])) as article_number,
    g.guidance_id,
    'curated' as method,
    'interpretation' as content_type
from {{ ref('dim_ai_act_guidance') }} as g
