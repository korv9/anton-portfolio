-- Editorial links from a concept to a measure elsewhere on the site: a Philosophy Atlas
-- tension, a Riksdag framing group, an AI Act view or a job-ad term. A person chose each link
-- (seeds/concepts/concept_links.csv); the target's own data is unchanged. A link is made only
-- where the target measures the same idea; a concept may have none.
select
    concept_id,
    kind,
    target_id,
    note,
    'interpretation' as content_type
from {{ ref('concept_links') }}
