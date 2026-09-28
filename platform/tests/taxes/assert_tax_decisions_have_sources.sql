-- Every tax decision is traceable: a government decision names a bill that exists in
-- Riksdagen's data, and every decision's report has a roll call.
select decision_key, 'bill not found' as problem
from {{ ref('dim_tax_decision') }}
where origin = 'government' and bill_title is null
union all
select d.decision_key, 'no roll call in its report'
from {{ ref('dim_tax_decision') }} as d
where not exists (select 1 from {{ ref('fct_tax_decision_vote') }} as v
                  where v.decision_key = d.decision_key)
