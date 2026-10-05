-- One point on the Symbolic Atlas per sampled occurrence: where UMAP put its context, which
-- HDBSCAN cluster it fell in (numbered, never named; -1 is noise), and what it is.
select
    p.occurrence_id,
    o.symbol_id,
    o.document_id,
    d.title,
    o.tradition,
    o.matched_term,
    o.context,
    p.x,
    p.y,
    p.cluster_id,
    p.cluster_probability,
    p.is_noise
from {{ source('symbolic_features', 'atlas_projection') }} as p
join {{ ref('int_symbol_occurrences') }} as o using (occurrence_id)
join {{ ref('int_symbolic_documents') }} as d using (document_id)
