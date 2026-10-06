-- The curated concepts (seeds/concepts/concepts.csv): an editorial list, each with an anchor
-- sentence per language that the concept layer embeds. Interpretation, not a finding.
select
    concept_id,
    label_en,
    label_sv,
    family,
    description_en,
    description_sv,
    anchor_en,
    anchor_sv,
    status,
    created_by,
    method,
    sort_order,
    'interpretation' as content_type
from {{ ref('concepts') }}
