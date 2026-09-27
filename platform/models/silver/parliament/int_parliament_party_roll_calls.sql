-- How each party voted on each roll call: its members' votes and the party's position, the
-- option most of its present members chose. A party split evenly has no position ('split').
{{ config(materialized="table") }}

with counts as (
    select session, vote_id || case when subject = 'motivfrågan' then ':motiv' else '' end
               as roll_call_id,
           party,
           count(*) as members,
           count(*) filter (where vote = 'yes') as yes,
           count(*) filter (where vote = 'no') as no,
           count(*) filter (where vote = 'abstain') as abstain,
           count(*) filter (where vote = 'absent') as absent
    from {{ ref('stg_riksdagen_votes') }}
    where party <> '-'
    group by all
)
select c.*,
       c.members - c.absent as present,
       case
           when c.members = c.absent then 'absent'
           when c.yes > greatest(c.no, c.abstain) then 'yes'
           when c.no > greatest(c.yes, c.abstain) then 'no'
           when c.abstain > greatest(c.yes, c.no) then 'abstain'
           else 'split'
       end as position,
       -- Share of present members voting with the party's plurality: 1.0 is a united party.
       greatest(c.yes, c.no, c.abstain) / nullif(c.members - c.absent, 0) as cohesion
from counts as c
join {{ ref('int_parliament_roll_calls') }} using (session, roll_call_id)
