-- Riksdag committees, current and former, each assigned to one policy issue.
select c.committee_key, c.committee_code, c.committee_name, c.active_note, c.issue_key,
       i.issue_name_sv, i.issue_name_en
from {{ ref('committees') }} as c
join {{ ref('issues') }} as i using (issue_key)
