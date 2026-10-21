-- One row per corpus, method, session and party: the speeches and words behind the
-- budget-language audit. Zero matches are not evidence of silence.
select corpus, method, session, party, speeches, words, matched_speeches, hits, zero_areas, file_order
from {{ ref('stg_budget_language_coverage') }}
