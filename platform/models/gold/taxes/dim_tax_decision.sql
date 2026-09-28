-- Riksdag decisions that changed Swedish taxes, 2016 on: what changed, from when, in which
-- direction, the bill it came from and the committee report it was decided in. The seed
-- names each decision from the budget bills' chapters on taxes and the enacted law text; a
-- decision taken on the committee's own proposal or a reservation has no bill.
select
    d.decision_key,
    cast(d.in_force as date) as in_force,
    year(cast(d.in_force as date)) as in_force_year,
    d.component,
    d.direction,
    d.title_sv,
    d.title_en,
    nullif(d.bill, '') as bill,
    nullif(d.bill_section, '') as bill_section,
    b.title as bill_title,
    b.bill_date,
    b.department,
    d.report,
    split_part(d.report, ':', 1) as report_session,
    split_part(d.report, ':', 2) as report_designation,
    d.origin,
    d.source_url
from {{ ref('tax_decisions') }} as d
left join {{ ref('fct_bill') }} as b on b.bill = d.bill
