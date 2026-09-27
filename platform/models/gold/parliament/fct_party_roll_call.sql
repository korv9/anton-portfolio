-- How each party voted on each roll call, and the party's role that day: in government, in a
-- written agreement with the government, or in opposition.
select
    p.session, p.roll_call_id, r.vote_id, r.is_substantive, p.party, r.vote_date, r.issue_key,
    p.members, p.present, p.yes, p.no, p.abstain, p.absent, p.position, p.cohesion,
    case when list_contains(g.government_parties, p.party) then 'government'
         when list_contains(coalesce(g.agreement_parties, []), p.party) then 'agreement'
         else 'opposition' end as role,
    p.position in ('yes', 'no') and p.position = r.outcome as on_winning_side,
    p.position in ('yes', 'no') and p.position = r.government_position as with_government
from {{ ref('int_parliament_party_roll_calls') }} as p
join {{ ref('fct_roll_call') }} as r using (session, roll_call_id)
left join {{ ref('dim_government') }} as g using (government_key)
