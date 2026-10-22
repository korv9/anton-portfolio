-- Ads per month × occupation group; field is the group's occupation field, with the 2023 labels
-- harmonised through occupation_field_crosswalk. JobTech files a few groups under another field in
-- some months (Kundtjänstpersonal, Banktjänstemän, Barnskötare), so each group keeps the field
-- with the most ads over the whole period; ties go to the first field name.
with harmonised as (
    select a.month, a.occupation_group, coalesce(x.field, a.occupation_field) as occupation_field, a.ads
    from {{ ref('stg_job_ad_occupation_month') }} as a
    left join {{ ref('occupation_field_crosswalk') }} as x on x.label = a.occupation_field
),
group_field as (
    select occupation_group, first(occupation_field order by ads desc, occupation_field) as occupation_field
    from (select occupation_group, occupation_field, sum(ads) as ads from harmonised group by all)
    group by occupation_group
)
select h.month, h.occupation_group, g.occupation_field, sum(h.ads) as ads
from harmonised as h
join group_field as g using (occupation_group)
group by h.month, h.occupation_group, g.occupation_field
