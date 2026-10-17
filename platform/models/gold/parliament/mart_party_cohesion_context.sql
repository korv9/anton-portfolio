-- Member-weighted unity and participation have distinct denominators.
select p.session, r.government_key, p.issue_key, p.party, count(*) as roll_calls,
       sum(p.members) as eligible, sum(p.present) as present,
       sum(p.abstain) as abstain_votes,
       sum(case when p.position in ('yes', 'no', 'abstain') then p.present else 0 end) as comparable_cast,
       sum(case when p.position in ('yes', 'no', 'abstain') then greatest(p.yes, p.no, p.abstain) else 0 end) as aligned_cast,
       count(*) filter (where (p.yes > 0)::int + (p.no > 0)::int + (p.abstain > 0)::int > 1) as mixed_roll_calls,
       count(*) filter (where p.position in ('yes', 'no') and r.government_position in ('yes', 'no')) as pm_compared,
       count(*) filter (where p.position in ('yes', 'no') and r.government_position in ('yes', 'no') and p.position = r.government_position) as pm_same
from {{ ref('fct_party_roll_call') }} p
join {{ ref('fct_roll_call') }} r using (session, roll_call_id)
where p.is_substantive
group by all
