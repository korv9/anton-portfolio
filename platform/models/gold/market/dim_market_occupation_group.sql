-- Occupation groups (SSYK 4) as the ads name them, each in its occupation field. A group's
-- label and field are those of its latest month, so a renamed group keeps one row.
select
    group_id,
    arg_max(ssyk, month) as ssyk,
    arg_max(occupation_group, month) as occupation_group,
    arg_max(field_id, month) as field_id,
    arg_max(field, month) as field,
    min(month) as first_month,
    max(month) as last_month
from {{ ref('stg_market_ads') }}
where group_id is not null
group by group_id
