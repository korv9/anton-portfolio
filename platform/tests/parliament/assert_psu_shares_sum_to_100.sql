-- Each PSU survey's party shares, "other" included, add to 100 within rounding.
select survey_month, sum(share_pct) as total
from {{ ref('fct_party_poll') }}
group by survey_month
having abs(sum(share_pct) - 100) > 1.0
