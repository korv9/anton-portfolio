-- Registered confounders: analysis × confounder with the diagnostic that looks for it, its
-- effect, the mitigation and the risk that remains (interpretation).
select
    analysis,
    confounder,
    diagnostic,
    effect,
    mitigation,
    remaining_risk,
    'interpretation' as content_type
from {{ ref('stg_quality_confounders') }}
