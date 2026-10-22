-- Ads per month × occupation group × occupation field.
select month, occupation_group, occupation_field, ads
from {{ source('clusters', 'job_ad_occupation_month') }}
