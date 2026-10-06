-- Every shared_tension link points at a tension the Philosophy Atlas defines.
select r.*
from {{ ref('mart_concept_relations') }} as r
left join {{ ref('dim_tension') }} as t using (tension_id)
where r.relation_type = 'shared_tension' and t.tension_id is null
