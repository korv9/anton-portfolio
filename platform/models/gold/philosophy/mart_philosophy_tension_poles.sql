-- Per tension, the five passages closest to each pole (largest and smallest position), from
-- any work: what the lens picks out, to read against the words. Derived.
with ranked as (
    select
        s.tension_id,
        s.passage_id,
        s.position,
        p.document_id,
        p.text,
        row_number() over (partition by s.tension_id order by s.position desc) as rank_a,
        row_number() over (partition by s.tension_id order by s.position asc) as rank_b
    from {{ source('philosophy_features', 'tensions') }} as s
    join {{ ref('int_philosophy_passages') }} as p using (passage_id)
)

select tension_id, 'a' as pole, rank_a as rank, passage_id, document_id, position, text
from ranked where rank_a <= 5
union all
select tension_id, 'b', rank_b, passage_id, document_id, position, text
from ranked where rank_b <= 5
