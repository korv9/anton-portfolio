-- The studies behind each tax decision: those its bill names as preparation. In a budget bill,
-- only those named in the preparation of the decision's own proposal (e.g. 12.1 for 12.1.3).
select d.decision_key, s.study_key, s.context
from {{ ref('dim_tax_decision') }} as d
join {{ ref('fct_bill_study') }} as s on s.bill = d.bill
where d.bill_section is null
   or s.section = d.bill_section
   or starts_with(d.bill_section, s.section || '.')
   or starts_with(s.section, d.bill_section || '.')
