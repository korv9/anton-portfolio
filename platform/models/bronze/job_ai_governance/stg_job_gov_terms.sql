-- Ads matching each term per month and occupation field, summed over archives.
select
    cast(publication_month || '-01' as date) as month,
    field_id,
    term_id,
    sum(ads) as ads
from {{ source('jobtech_governance', 'terms') }}
where publication_month >= '2020-01'
group by 1, 2, 3
