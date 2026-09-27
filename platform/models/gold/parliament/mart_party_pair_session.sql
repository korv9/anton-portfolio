-- How often two parties took the same position, per riksmöte, over roll calls where both took
-- one (yes, no or abstain). The agreement matrix of the site, for every session since 1993/94.
with positions as (
    select session, roll_call_id, party, position
    from {{ ref('fct_party_roll_call') }}
    where position in ('yes', 'no', 'abstain') and is_substantive
)
select a.session, a.party as party_a, b.party as party_b,
       count(*) as comparable_roll_calls,
       count(*) filter (where a.position = b.position) as same_position,
       round(100.0 * count(*) filter (where a.position = b.position) / count(*), 1)
           as agreement_pct
from positions as a
join positions as b on a.session = b.session and a.roll_call_id = b.roll_call_id and a.party < b.party
group by a.session, a.party, b.party
