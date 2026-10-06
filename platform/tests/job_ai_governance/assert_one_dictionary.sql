-- Every archive was counted with the same dictionary, so months are comparable.
select count(distinct dictionary_sha256) as dictionaries
from {{ ref('stg_job_gov_manifests') }}
having count(distinct dictionary_sha256) > 1
