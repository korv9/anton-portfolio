-- A series never counts more items than its denominator holds.
select * from {{ ref('mart_ai_governance_timeline') }} where numerator > denominator
