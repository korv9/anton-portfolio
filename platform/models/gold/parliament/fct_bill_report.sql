-- Which committee report (betänkande) each bill was dealt with in. A budget bill goes to
-- many; most bills to one.
select distinct
    b.bill,
    r.session as report_session,
    r.designation,
    r.session || ':' || r.designation as report,
    r.title as report_title
from {{ ref('stg_riksdagen_bill_preparation') }} as b, unnest(b.reports) as t(r)
where r.designation is not null and r.designation <> ''
