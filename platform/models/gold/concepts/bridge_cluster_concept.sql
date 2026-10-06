-- A cluster (Symbolic or Philosophy Atlas) linked to a concept, only by a person's review
-- (seeds/concepts/cluster_concept_reviews.csv). Empty until someone reviews; never machine-made.
select
    concept_source,
    cluster_variant,
    fingerprint,
    concept_id,
    reviewer,
    reviewed_at,
    note,
    'interpretation' as content_type
from {{ ref('cluster_concept_reviews') }}
