-- One row per session, proposer and expenditure area: the corrected budget frame as the
-- legacy build delivers it (stg_budget_frame), so the frame's measures live in dbt.
select
    session, budget_year, actor, proposal_type, expenditure_area, expenditure_area_name,
    amount_msek, government_amount_msek, deviation_msek, budget_share_pct,
    document_id, source_url, make_date(cast(budget_year as integer), 1, 1) as budget_year_start,
    file_order
from {{ ref('stg_budget_frame') }}
