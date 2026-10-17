-- Comparable substantive positions, by exact vote-date government and policy area.
with positions as (
    select p.session, p.roll_call_id, p.party, p.position, r.government_key, p.issue_key
    from {{ ref('fct_party_roll_call') }} p
    join {{ ref('fct_roll_call') }} r using (session, roll_call_id)
    where p.is_substantive and p.position in ('yes', 'no', 'abstain')
)
select a.session, a.government_key, a.issue_key, a.party as party_a, b.party as party_b,
       count(*) as compared, count(*) filter (where a.position = b.position) as same
from positions a join positions b
    on a.session = b.session and a.roll_call_id = b.roll_call_id and a.party < b.party
group by all
