-- A budget year with a roll call must carry all eight parties' votes, never a partial set.
select budget_year, len(party_votes) as parties
from {{ ref('mart_budget_context') }}
where vote_id is not null and len(party_votes) <> 8
