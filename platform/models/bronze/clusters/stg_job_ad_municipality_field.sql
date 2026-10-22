-- Ads per year × municipality name (as JobTech spells it, null when the ad has none) × field.
select year, municipality, region, occupation_field, ads
from {{ source('clusters', 'job_ad_municipality_field') }}
