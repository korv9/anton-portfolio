-- Government bills (propositioner) since 2006/07: what the government proposed, when, from
-- which ministry, and the committee report the Riksdag decided it in.
select
    b.bill,
    b.session,
    b.number,
    b.prop_id,
    b.title,
    b.bill_date,
    b.department,
    b.has_section as has_preparation_section,
    len(b."references") as studies,
    b.source_url
from {{ ref('stg_riksdagen_bill_preparation') }} as b
