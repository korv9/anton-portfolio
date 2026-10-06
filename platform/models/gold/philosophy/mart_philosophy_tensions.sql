-- Work × tension: where a work's sampled passages sit along a lens (similarity to pole A minus
-- pole B), as mean and quartiles, and the passages nearest each pole. Derived embedding
-- similarity read through a chosen lens; not what the author holds.
with scores as (
    select s.*, p.document_id, p.text
    from {{ source('philosophy_features', 'tensions') }} as s
    join {{ ref('int_philosophy_passages') }} as p using (passage_id)
)

select
    tension_id,
    document_id,
    count(*) as passages,
    avg(position) as mean_position,
    quantile_cont(position, 0.25) as q1,
    quantile_cont(position, 0.5) as median,
    quantile_cont(position, 0.75) as q3,
    'derived' as content_type
from scores
group by tension_id, document_id
