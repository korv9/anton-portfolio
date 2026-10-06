-- Product × validity kind: diagnostics by status. Counts only; never a score.
select
    product_id,
    kind,
    count(distinct analysis_id) as analyses,
    count(*) as diagnostics,
    count(*) filter (where status = 'supported') as supported_count,
    count(*) filter (where status = 'warning') as warning_count,
    count(*) filter (where status = 'insufficient_evidence') as insufficient_evidence_count,
    count(*) filter (where status = 'invalidated') as invalidated_count,
    count(*) filter (where status = 'not_evaluated') as not_evaluated_count
from {{ ref('mart_analysis_validity') }}
group by all
