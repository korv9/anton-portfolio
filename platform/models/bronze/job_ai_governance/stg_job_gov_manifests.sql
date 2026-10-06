-- One row per counted archive: where it came from, its SHA-256, the dictionary it was counted
-- with, and how many ads it held.
select
    archive,
    source_url,
    sha256,
    dictionary_sha256,
    ads,
    ads_read,
    duplicates,
    cast(counted_at as timestamptz) as counted_at
from {{ source('jobtech_governance', 'manifests') }}
