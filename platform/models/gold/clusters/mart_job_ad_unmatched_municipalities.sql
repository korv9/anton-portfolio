-- Municipality names in the job ads that match no current SCB name (null: the ad has none).
select a.municipality, sum(a.ads) as ads, count(distinct a.year) as years
from {{ ref('stg_job_ad_municipality_field') }} as a
left join {{ ref('dim_municipality') }} as m
    on m.municipality_name = a.municipality and m.valid_to is null
where m.municipality_code is null
group by a.municipality
