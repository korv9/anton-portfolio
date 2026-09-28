-- The studies a bill names as its preparation, with the sentence that names them and, in a
-- budget bill, the number of the proposal whose preparation names them. The sentence is kept
-- so every link can be read against the bill itself.
select distinct on (b.bill, study_key)
    b.bill,
    case when r.kind = 'pm' then 'pm:' || lower(r.key) else r.kind || ':' || r.key end as study_key,
    r.kind,
    nullif(r.section, '') as section,
    r.context
from {{ ref('stg_riksdagen_bill_preparation') }} as b, unnest(b."references") as t(r)
