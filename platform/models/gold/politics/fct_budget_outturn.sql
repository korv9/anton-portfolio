-- One row per budget year and expenditure area: Statskontoret's approved budget, amendments
-- and outturn. Historical area definitions must be checked before joining a budget proposal.
select
    budget_year, expenditure_area, expenditure_area_name, approved_budget_msek, amendments_msek,
    outturn_msek, appropriation_rows, source_url, file_order
from {{ ref('stg_budget_outturn') }}
