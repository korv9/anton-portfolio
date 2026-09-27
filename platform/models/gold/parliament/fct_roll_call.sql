-- Every roll call in the Riksdag since 1993/94: what it concerned, how it went, and whether the
-- government's side won. The government's position is that of the prime minister's party.
select
    r.session, r.roll_call_id, r.vote_id, r.is_substantive, r.is_complete, r.designation, r.point, r.subject, r.vote_date,
    r.committee_key, c.committee_code, c.committee_name, c.issue_key,
    r.report_title, r.report_headline, r.document_id, r.report_url,
    r.members, r.yes, r.no, r.abstain, r.absent, r.outcome,
    g.government_key,
    pm.position as government_position,
    case when pm.position in ('yes', 'no') then pm.position = r.outcome end as government_won
from {{ ref('int_parliament_roll_calls') }} as r
left join {{ ref('dim_committee') }} as c using (committee_key)
left join {{ ref('dim_government') }} as g
    on r.vote_date >= g.start_date and r.vote_date < coalesce(g.end_date, date '9999-12-31')
left join {{ ref('int_parliament_party_roll_calls') }} as pm
    on pm.session = r.session and pm.roll_call_id = r.roll_call_id and pm.party = g.prime_minister_party
