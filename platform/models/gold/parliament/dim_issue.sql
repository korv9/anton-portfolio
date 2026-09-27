-- Policy issues: the committees that handle them, the budget expenditure areas (utgiftsområden)
-- they decide, and the welfare indicators that describe the outcome they concern. The links
-- are for reading side by side; none of them is a claim that a decision caused a figure.
select
    i.issue_key, i.issue_name_sv, i.issue_name_en, i.summary_sv,
    [cast(area as integer) for area in string_split(i.expenditure_areas, '|')] as expenditure_areas,
    case when i.welfare_indicators is not null
         then string_split(i.welfare_indicators, '|') else [] end as welfare_indicators,
    -- Standing committees first, joint committees after.
    list(c.committee_code order by c.active_note is not null and c.active_note like 'Sammansatt%', c.committee_code) as committees
from {{ ref('issues') }} as i
left join {{ ref('committees') }} as c using (issue_key)
group by all
