-- Documents per corpus and month, summed over the counted sources (the speeches, or one ad
-- archive each).
select
    case when filename like '%speeches_months.parquet' then 'riksdag' else 'job_ads' end as corpus,
    cast(month || '-01' as date) as month,
    sum(documents) as documents
from {{ source('ai_act_diffusion', 'months') }}
group by all
