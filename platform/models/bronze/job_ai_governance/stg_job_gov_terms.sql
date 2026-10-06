-- Ads matching each term per month and occupation field, summed over archives.
select
    cast(publication_month || '-01' as date) as month,
    field_id,
    term_id,
    sum(ads) as ads
from {{ source('jobtech_governance', 'terms') }}
-- A few ads carry impossible publication dates (2051, 2099); months after the build date are left out.
where publication_month >= '2020-01' and publication_month <= strftime(current_date, '%Y-%m')
group by 1, 2, 3
