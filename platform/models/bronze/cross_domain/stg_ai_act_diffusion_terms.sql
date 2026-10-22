-- Documents matching each term per corpus, language and month, summed over the counted sources.
select
    case when filename like '%speeches_terms.parquet' then 'riksdag' else 'job_ads' end as corpus,
    cast(month || '-01' as date) as month,
    split_part(term_key, ':', 1) as term_id,
    split_part(term_key, ':', 2) as language,
    sum(documents) as matches
from {{ source('ai_act_diffusion', 'terms') }}
group by all
