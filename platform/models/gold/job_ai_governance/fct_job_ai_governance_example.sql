-- Example ads per term and archive (masked context windows), for judging what the words catch.
select term_id, ad_id, archive, publication_month, headline, occupation, field, matched, context
from {{ ref('stg_job_gov_examples') }}
