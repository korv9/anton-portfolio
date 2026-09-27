-- The two sources agree on the election both publish (2022): the same votes and seats per
-- party, and the same share to SCB's one decimal. If this fails, one source has changed.
with scb as (
    select e.party, e.votes, e.share_pct, s.seats
    from {{ ref('stg_scb_elections') }} as e
    join {{ ref('stg_scb_election_seats') }} as s using (election_year, party)
    where e.region_code = '00' and e.election_year = 2022
), val as (
    select party, votes, share_pct, seats
    from {{ ref('stg_val_riksdag_result') }}
    where election_year = 2022 and party <> 'OTHER'
)
select *
from scb full join val using (party)
where scb.votes is distinct from val.votes or scb.seats is distinct from val.seats
   or abs(scb.share_pct - val.share_pct) > 0.051
