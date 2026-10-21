-- One row per counted JobTech archive: source URL, SHA-256, the dictionary it was counted with,
-- and its ads.
select archive, source_url, sha256, dictionary_sha256, ads, ads_read, duplicates, counted_at
from {{ ref('stg_job_gov_manifests') }}
