-- Every document of the AI Act's family: the act, its consolidated versions, the acts amending
-- and correcting it, proposals to amend it and acts based on it. Source: Cellar.
select
    document_id,
    celex,
    relation,
    document_type,
    document_type_basis,
    title,
    title_basis,
    published_at,
    valid_from,
    valid_to,
    coalesce(is_current, false) as is_current,
    version_hash,
    text_languages,
    text_retrieved_at as retrieved_at,
    cellar_retrieved_at,
    source_url,
    'source' as content_type
from {{ ref('int_ai_act_documents') }}
