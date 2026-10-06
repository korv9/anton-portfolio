-- One row per sampled passage and map variant (baseline, author_centered): map position,
-- cluster (-1 is noise) and membership probability, with the passage and its work. Derived.
select
    a.variant,
    a.passage_id,
    p.document_id,
    d.author,
    d.title,
    d.tradition,
    d.period,
    d.year,
    d.translator,
    p.position,
    p.text,
    a.x,
    a.y,
    a.cluster_id,
    a.probability,
    a.cluster_id = -1 as is_noise
from {{ source('philosophy_features', 'atlas') }} as a
join {{ ref('int_philosophy_passages') }} as p using (passage_id)
join {{ ref('dim_philosophy_document') }} as d on d.document_id = p.document_id
