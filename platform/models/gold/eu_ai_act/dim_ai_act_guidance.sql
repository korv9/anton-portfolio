-- The Commission's guidance, codes of practice and templates for the AI Act, as published on
-- its pages: title and date read from each page, `kind` is our classification.
select
    guidance_id,
    kind,
    title,
    published_at,
    published_basis,
    source_url,
    articles_json,
    source_hash,
    first_fetched_at,
    last_fetched_at,
    version_count,
    'source' as content_type
from {{ ref('int_ai_act_guidance') }}
