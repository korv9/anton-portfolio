-- Each party's voting record per riksmöte: attendance, unity, how often it was on the winning
-- side and how often it voted with the government. Comparable across all 33 sessions.
-- Decisions only: roll calls on the reasons for a decision (motivfrågan) are left out.
select
    session, party,
    count(*) as roll_calls,
    mode(role) as role,
    round(100 * sum(present) / sum(members), 1) as attendance_pct,
    round(100 * avg(cohesion), 1) as cohesion_pct,
    round(100 * avg(case when position in ('yes', 'no') then on_winning_side::int end), 1)
        as on_winning_side_pct,
    round(100 * avg(case when position in ('yes', 'no') then with_government::int end), 1)
        as with_government_pct,
    round(100 * avg((position = 'abstain')::int), 1) as abstained_pct
from {{ ref('fct_party_roll_call') }}
where is_substantive
group by session, party
