-- Ads per month × occupation group; field is the group's occupation field, with the 2023 labels
-- harmonised through occupation_field_crosswalk.
select
    a.month, a.occupation_group,
    any_value(coalesce(x.field, a.occupation_field)) as occupation_field,
    sum(a.ads) as ads
from {{ ref('stg_job_ad_occupation_month') }} as a
left join {{ ref('occupation_field_crosswalk') }} as x on x.label = a.occupation_field
group by a.month, a.occupation_group
