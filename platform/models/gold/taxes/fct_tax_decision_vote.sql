-- How each party voted on each tax decision: the first substantive roll call in the committee
-- report the decision was taken in. For a budget framework report (FiU1) that is the vote on
-- the framework, taxes included; the point is kept so the vote can be checked.
with first_roll_call as (
    select
        d.decision_key,
        r.session,
        r.roll_call_id,
        r.point,
        r.vote_date,
        r.outcome,
        r.government_won,
        r.yes, r.no, r.abstain, r.absent
    from {{ ref('dim_tax_decision') }} as d
    join {{ ref('fct_roll_call') }} as r
        on r.session = d.report_session and r.designation = d.report_designation
    where r.is_substantive
    qualify row_number() over (partition by d.decision_key
                               order by try_cast(r.point as integer) nulls last, r.roll_call_id) = 1
)
select
    f.decision_key,
    f.session,
    f.roll_call_id,
    f.point,
    f.vote_date,
    f.outcome,
    f.government_won,
    p.party,
    p.position,
    p.role
from first_roll_call as f
join {{ ref('fct_party_roll_call') }} as p
    on p.session = f.session and p.roll_call_id = f.roll_call_id
