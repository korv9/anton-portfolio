-- One row per roll call, with the committee report it concerns. Test votes (the Riksdag's
-- voting system is tested in the chamber and the tests are published) are left out.
--
-- One vote id can carry two roll calls: on the matter itself (sakfrågan) and on the reasons
-- given for the decision (motivfrågan). roll_call_id tells them apart; is_substantive marks
-- the decision itself. The earliest files do not record which it was, and their ids are unique.
with votes as (
    select *,
           vote_id || case when subject = 'motivfrågan' then ':motiv' else '' end as roll_call_id
    from {{ ref('stg_riksdagen_votes') }}
    where designation is not null
      and not regexp_matches(lower(designation), '^(test|p$)')
), roll_calls as (
    select session, roll_call_id, any_value(vote_id) as vote_id,
           any_value(designation) as designation, any_value(point) as point,
           any_value(subject) as subject, min(vote_date) as vote_date,
           count(*) as members,
           count(*) filter (where vote = 'yes') as yes,
           count(*) filter (where vote = 'no') as no,
           count(*) filter (where vote = 'abstain') as abstain,
           count(*) filter (where vote = 'absent') as absent
    from votes
    group by session, roll_call_id
)
select
    r.* exclude (vote_date),
    -- A few roll calls carry no date in the source; the report's decision date stands in.
    coalesce(r.vote_date, rep.decision_date) as vote_date,
    r.vote_date is null as vote_date_from_report,
    -- The committee is the designation's leading letters (FiU12 -> fiu). A few designations
    -- name no committee ('0604-1', 'p19'); those roll calls go to 'ovrigt'.
    coalesce(c.committee_key, 'ovrigt') as committee_key,
    rep.title as report_title, rep.headline as report_headline, rep.document_id,
    rep.source_url as report_url,
    case when r.yes > r.no then 'yes' when r.no > r.yes then 'no' else 'tie' end as outcome,
    r.subject is distinct from 'motivfrågan' as is_substantive,
    -- Three roll calls in the source list fewer than 349 members.
    r.members = 349 as is_complete
from roll_calls as r
left join {{ ref('committees') }} as c
    on c.committee_key = lower(regexp_extract(r.designation, '^([A-Za-zÅÄÖåäö]+)', 1))
left join {{ ref('stg_riksdagen_reports') }} as rep
    on rep.session = r.session and lower(rep.designation) = lower(r.designation)
