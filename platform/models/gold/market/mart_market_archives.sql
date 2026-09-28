-- The archives counted: which file, when, and how many ads it held.
select
    archive,
    source_url,
    sha256,
    ads_read,
    duplicates,
    ads,
    cast(counted_at as timestamp) as counted_at
from {{ source('jobtech_market', 'manifests') }}
