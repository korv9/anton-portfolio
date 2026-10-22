-- Every counted source used the same term list, so the corpora are counted alike.
select count(distinct dictionary_sha256) as lists
from {{ ref('stg_ai_act_diffusion_sources') }}
having count(distinct dictionary_sha256) > 1
