-- Occupation fields (yrkesområden), with their latest label.
select
    field_id,
    arg_max(field, month) as field,
    count(distinct group_id) as occupation_groups
from {{ ref('stg_market_ads') }}
where field_id is not null
group by field_id
