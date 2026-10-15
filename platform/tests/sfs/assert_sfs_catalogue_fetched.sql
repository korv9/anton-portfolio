-- Every document in the SFS list has a fetched text. A few dead links only warn (one dok_id
-- in the list returns 404); more than 12, about 0.1 per cent, means the fetch stopped early.
{{ config(warn_if='>0', error_if='>12') }}
select dok_id, sfs, title
from {{ ref('silver_sfs_documents') }}
where not has_text
