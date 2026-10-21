{{ config(tags=['sweden_futures']) }}
-- DiVA thesis abstracts at their latest harvested month: record × theme. A record comes back in a
-- later month when DiVA changes or deletes it; only its latest month counts, and a null year there
-- (deleted, or no Swedish abstract) leaves it out of the marts.
select *
from {{ ref('stg_futures_theses') }}
qualify (case when month = 'before-2000' then '0000-00' else month end)
    = max(case when month = 'before-2000' then '0000-00' else month end) over (partition by id)
