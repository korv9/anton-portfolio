-- Riksdag election results for the whole country, one row per election and party: votes, share
-- of valid votes and seats. SCB for 1973-2022; Valmyndigheten for an election SCB has not yet
-- published. Small parties are summed into OTHER; blank and invalid ballots are left out.
with scb_votes as (
    select election_year, party, votes, share_pct
    from {{ ref('stg_scb_elections') }}
    where region_code = '00' and party_code not in ('OGILTIGA', 'VALSKOLKARE')
), scb as (
    -- A full join: SCB's vote table has no row for Ny demokrati (1991, 1994), whose votes sit
    -- in ÖVRIGA, while its seat table does. Its seats are kept; its votes stay in OTHER.
    select coalesce(v.election_year, s.election_year) as election_year,
           coalesce(v.party, s.party) as party, v.votes, v.share_pct, s.seats, 'SCB' as source
    from scb_votes as v
    full join {{ ref('stg_scb_election_seats') }} as s using (election_year, party)
    where coalesce(v.votes, 0) > 0 or coalesce(s.seats, 0) > 0
), val as (
    select election_year, party, sum(votes) as votes, sum(share_pct) as share_pct,
           sum(seats) as seats, 'Valmyndigheten' as source
    from {{ ref('stg_val_riksdag_result') }}
    where election_year not in (select election_year from scb)
    group by election_year, party
)
select election_year, case when party = 'ÖVRIGA' then 'OTHER' else party end as party,
       votes, share_pct, coalesce(seats, 0) as seats, source
from scb
union all
select election_year, party, votes, round(share_pct, 2), coalesce(seats, 0), source from val
