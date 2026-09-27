{{ config(tags=["parliament"]) }}

-- The long history is built from Riksdagen's roll-call files; the detailed evidence layer of
-- recent sessions was built independently from the same files. Every party result that layer
-- delivers must have an identical row here: the same yes, no, abstain and absent counts.
select l.session, l.vote_id, l.party
from {{ ref('stg_party_vote') }} as l
where not exists (
    select 1
    from {{ ref('fct_party_roll_call') }} as p
    where p.session = l.session and p.vote_id = upper(l.vote_id) and p.party = l.party
      and p.yes = l.yes_votes and p.no = l.no_votes
      and p.abstain = l.abstain_votes and p.absent = l.absent_votes
)
