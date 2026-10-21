-- One row per profiled RFC version. Requirement counts are heuristic keyword extraction, not
-- matched changes. Delivered as gold/tables/fact_rfc_version.json.
select rfc, url, sha256, requirements, counts, shares_pct, file_order
from {{ ref('stg_rfc_version') }}
