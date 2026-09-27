-- SCB's party preference survey (PSU): the share who would vote for each party "if there were
-- an election today", with SCB's margin of error, from 1972.
select survey_month, party, share_pct, margin_of_error_pp,
       change_since_election_pp, change_since_last_survey_pp
from {{ ref('stg_scb_psu') }}
