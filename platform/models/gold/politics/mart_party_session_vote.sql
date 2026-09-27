-- One row per session with roll calls and party: how often the party voted yes, no or
-- abstained as a group, and the member counts behind cohesion and recorded attendance.
-- Percentages are formed at delivery (publish/export_politics.py) so they round exactly
-- as the legacy build did.
with sessions as (
    select distinct session from {{ ref('mart_vote_decisions') }}
)
select
    v.session,
    v.party,
    count(*) as roll_calls,
    count(*) filter (where v.party_position = 'Ja') as yes_calls,
    count(*) filter (where v.party_position = 'Nej') as no_calls,
    count(*) filter (where v.party_position = 'Avstår') as abstain_calls,
    sum(v.cast_votes) as cast_member_votes,
    sum(v.absent_votes) as recorded_absences,
    sum(greatest(v.yes_votes, v.no_votes, v.abstain_votes)) as cohesive_member_votes
from {{ ref('stg_party_vote') }} as v
join sessions using (session)
group by v.session, v.party
