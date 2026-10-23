-- One row per counted source: its corpus, the dates it covers and the term list it was counted with.
select
    case when source = 'speeches' then 'riksdag' else 'job_ads' end as corpus,
    source,
    cast(first_date as date) as first_date,
    cast(last_date as date) as last_date,
    documents,
    dictionary_sha256,
    cast(counted_at as timestamptz) as counted_at
from {{ source('ai_act_diffusion', 'sources') }}
