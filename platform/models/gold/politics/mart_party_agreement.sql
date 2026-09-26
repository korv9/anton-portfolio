-- One row per session and ordered party pair (including a party with itself): of the roll
-- calls where both took a Ja or Nej position, how many had the same one. Abstentions are
-- not comparable. Not an ideological distance.
with sessions as (
    select distinct session from {{ ref('mart_vote_decisions') }}
), votes as (
    select v.* from {{ ref('stg_party_vote') }} as v join sessions using (session)
)
select
    a.session,
    a.party as party_a,
    b.party as party_b,
    count(*) filter (where a.party_position in ('Ja', 'Nej') and b.party_position in ('Ja', 'Nej')
                     and a.party_position = b.party_position) as same_position_calls,
    count(*) filter (where a.party_position in ('Ja', 'Nej') and b.party_position in ('Ja', 'Nej'))
        as comparable_calls
from votes as a
join votes as b on a.vote_id = b.vote_id
group by a.session, a.party, b.party
