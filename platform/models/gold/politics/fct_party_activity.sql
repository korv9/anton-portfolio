-- One row per session and party: debate speeches, interpellations and written questions.
-- Delivered as gold/tables/fact_activity.json.
select session, party, debate_speeches, interpellations, written_questions, file_order
from {{ ref('stg_party_activity') }}
