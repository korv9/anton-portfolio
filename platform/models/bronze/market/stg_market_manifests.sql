-- One record per JobTech archive counted.
select * from {{ source('jobtech_market', 'manifests') }}
